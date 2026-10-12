<?php

namespace App\Services;

use App\Enums\Role;
use App\Enums\StockMovementType;
use App\Enums\TaskPriority;
use App\Models\Article;
use App\Models\StockMovement;
use App\Models\Task;
use App\Models\User;
use App\Support\PermissionCatalog;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Mouvements de stock et valorisation au coût moyen unitaire pondéré (CMUP, D-011) :
 * - une entrée au coût c de q unités : CMUP = (Q × CMUP + q × c) / (Q + q) ;
 * - une sortie se fait au CMUP du moment, qui ne change pas ;
 * - l'annulation d'une entrée la retire à son propre coût (le CMUP revient à ce qu'il aurait été).
 * Chaque mouvement verrouille l'article, garde la quantité et le CMUP après lui, puis vérifie le seuil
 * d'alerte. Rien ne se modifie ni ne se supprime : une erreur se corrige par le mouvement inverse.
 */
class StockService
{
    /**
     * Entrée en stock au coût unitaire donné (achat, retour d'un chantier ou d'une vente).
     *
     * @param  array<string, mixed>  $context  moved_on, reason, worksite_id, purchase_id, invoice_id, reverses_id
     */
    public function receive(Article $article, float $quantity, float $unitCost, StockMovementType $type, array $context, ?User $by): StockMovement
    {
        $this->ensurePositive($quantity);

        return $this->move($article, function (Article $a) use ($quantity, $unitCost) {
            $before = max(0.0, $a->quantity);
            $after = round($a->quantity + $quantity, 2);
            $average = $before + $quantity > 0 && $a->quantity > 0
                ? ($before * $a->average_cost + $quantity * $unitCost) / ($before + $quantity)
                : $unitCost;

            return [$quantity, $unitCost, $after, $average];
        }, $type, $context, $by);
    }

    /**
     * Sortie au CMUP du moment (chantier, vente, perte). Refusée au-delà du stock disponible, sauf si
     * le stock négatif est permis (`STOCK_ALLOW_NEGATIVE`).
     *
     * @param  array<string, mixed>  $context
     */
    public function issue(Article $article, float $quantity, StockMovementType $type, array $context, ?User $by): StockMovement
    {
        $this->ensurePositive($quantity);

        return $this->move($article, function (Article $a) use ($quantity) {
            if (! config('borom.stock_allow_negative') && round($a->quantity - $quantity, 2) < 0) {
                throw ValidationException::withMessages(['quantity' => "{$a->name} : seulement ".self::qty($a->quantity)." {$a->unit} en stock."]);
            }

            return [-$quantity, $a->average_cost, round($a->quantity - $quantity, 2), $a->average_cost];
        }, $type, $context, $by);
    }

    /**
     * Retire une entrée à son propre coût (annulation d'un achat) : le CMUP redevient celui qu'il aurait
     * été sans elle. Refusée si la marchandise est déjà sortie.
     *
     * @param  array<string, mixed>  $context
     */
    public function reverseEntry(Article $article, float $quantity, float $unitCost, StockMovementType $type, array $context, ?User $by): StockMovement
    {
        $this->ensurePositive($quantity);

        return $this->move($article, function (Article $a) use ($quantity, $unitCost) {
            $after = round($a->quantity - $quantity, 2);
            if ($after < 0) {
                throw ValidationException::withMessages(['purchase' => "{$a->name} : la marchandise est déjà sortie du stock (reste ".self::qty($a->quantity)." {$a->unit})."]);
            }
            $average = $after > 0 ? max(0.0, ($a->quantity * $a->average_cost - $quantity * $unitCost) / $after) : $a->average_cost;

            return [-$quantity, $unitCost, $after, $average];
        }, $type, $context, $by);
    }

    /**
     * Ajustement à une quantité constatée (inventaire, correction) : l'écart est valorisé au CMUP, qui
     * ne change pas.
     *
     * @param  array<string, mixed>  $context
     */
    public function adjustTo(Article $article, float $counted, StockMovementType $type, array $context, ?User $by): ?StockMovement
    {
        if ($counted < 0) {
            throw ValidationException::withMessages(['quantity' => 'Une quantité comptée ne peut pas être négative.']);
        }
        $delta = round($counted - Article::query()->whereKey($article->id)->value('quantity'), 2);
        if ($delta == 0) {
            return null;
        }

        return $this->move($article, fn (Article $a) => [round($counted - $a->quantity, 2), $a->average_cost, round($counted, 2), $a->average_cost], $type, $context, $by);
    }

    /**
     * @param  callable(Article): array{0: float, 1: float, 2: float, 3: float}  $compute  [quantité signée, coût unitaire, quantité après, CMUP après]
     * @param  array<string, mixed>  $context
     */
    private function move(Article $article, callable $compute, StockMovementType $type, array $context, ?User $by): StockMovement
    {
        $movement = DB::transaction(function () use ($article, $compute, $type, $context, $by) {
            $locked = Article::query()->lockForUpdate()->findOrFail($article->id);
            [$quantity, $unitCost, $after, $average] = $compute($locked);

            $movement = $locked->movements()->create([
                'type' => $type,
                'quantity' => round($quantity, 2),
                'unit_cost' => round($unitCost, 4),
                'value' => (int) round($quantity * $unitCost),
                'quantity_after' => $after,
                'average_cost_after' => round($average, 4),
                'moved_on' => $context['moved_on'] ?? today()->toDateString(),
                'reason' => $context['reason'] ?? null,
                'worksite_id' => $context['worksite_id'] ?? null,
                'purchase_id' => $context['purchase_id'] ?? null,
                'invoice_id' => $context['invoice_id'] ?? null,
                'inventory_id' => $context['inventory_id'] ?? null,
                'reverses_id' => $context['reverses_id'] ?? null,
                'created_by' => $by?->id,
            ]);
            // Mise à jour technique (le mouvement fait foi) : pas de ligne de journal par mouvement.
            $locked->forceFill(['quantity' => $after, 'average_cost' => round($average, 4)])->saveQuietly();
            $article->setRawAttributes($locked->getAttributes(), true);

            return $movement;
        });
        $this->checkLowStock($article->fresh());

        return $movement;
    }

    /**
     * Seuil d'alerte atteint : une tâche « réapprovisionner », une seule fois tant que le stock ne
     * remonte pas au-dessus du seuil.
     */
    public function checkLowStock(Article $article): void
    {
        if (! $article->isLow()) {
            if ($article->low_stock_alerted_at) {
                $article->forceFill(['low_stock_alerted_at' => null])->saveQuietly();
            }

            return;
        }
        if ($article->low_stock_alerted_at || ! $article->is_active) {
            return;
        }

        Task::create([
            'user_id' => $this->stockKeeper()?->id,
            'title' => "Réapprovisionner {$article->name} ({$article->reference})",
            'details' => 'Stock : '.self::qty($article->quantity)." {$article->unit}, seuil d'alerte ".self::qty($article->min_quantity)." {$article->unit}"
                .($article->max_quantity ? ', stock maximum '.self::qty($article->max_quantity)." {$article->unit}" : '')
                .($article->supplier ? ".\nFournisseur habituel : {$article->supplier->name}".($article->supplier->phone ? " ({$article->supplier->phone})" : '') : '.'),
            'due_at' => now(),
            'priority' => TaskPriority::Haute,
        ]);
        $article->forceFill(['low_stock_alerted_at' => now()])->saveQuietly();
    }

    public static function qty(float $quantity): string
    {
        return rtrim(rtrim(number_format($quantity, 2, ',', ' '), '0'), ',');
    }

    private function ensurePositive(float $quantity): void
    {
        if ($quantity <= 0) {
            throw ValidationException::withMessages(['quantity' => 'La quantité doit être positive.']);
        }
    }

    private function stockKeeper(): ?User
    {
        return User::query()->active()->withRole(Role::ResponsableTravaux->value)->orderBy('id')->first()
            ?? User::query()->active()->withRole(PermissionCatalog::SUPER_ADMIN)->orderBy('id')->first();
    }
}
