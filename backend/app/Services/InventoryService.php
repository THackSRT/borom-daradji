<?php

namespace App\Services;

use App\Enums\StockMovementType;
use App\Models\Article;
use App\Models\Inventory;
use App\Models\User;
use App\Support\Sequence;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Inventaire physique : une liste des articles actifs (tous, ou une catégorie) à compter ; à la
 * validation, chaque article compté est ajusté à la quantité comptée et l'écart est valorisé au CMUP.
 * Le stock théorique est relevé au moment de la validation : les mouvements du comptage sont pris en
 * compte. Un article non compté n'est pas touché. Un seul inventaire en cours à la fois.
 */
class InventoryService
{
    public function __construct(private StockService $stock) {}

    /**
     * @param  array{counted_on?: string|null, article_category_id?: int|null, notes?: string|null}  $data
     */
    public function start(array $data, User $by): Inventory
    {
        if (Inventory::query()->where('status', 'en_cours')->exists()) {
            throw ValidationException::withMessages(['inventory' => 'Un inventaire est déjà en cours : validez-le ou supprimez-le d\'abord.']);
        }

        return DB::transaction(function () use ($data, $by) {
            $inventory = new Inventory([...$data, 'counted_on' => $data['counted_on'] ?? today()->toDateString(), 'created_by' => $by->id]);
            $inventory->number = sprintf('INV-%d-%03d', now()->year, Sequence::next('inventaire'));
            $inventory->save();

            $articles = Article::query()->where('is_active', true)
                ->when($data['article_category_id'] ?? null, fn ($q, $v) => $q->where('article_category_id', $v))
                ->orderBy('name')->pluck('id');
            if ($articles->isEmpty()) {
                throw ValidationException::withMessages(['article_category_id' => 'Aucun article à compter.']);
            }
            $inventory->lines()->createMany($articles->map(fn ($id) => ['article_id' => $id])->all());

            return $inventory;
        });
    }

    /**
     * @param  list<array{article_id: int, counted_quantity: float|int|string|null, note?: string|null}>  $counts
     */
    public function count(Inventory $inventory, array $counts): Inventory
    {
        $this->ensureOpen($inventory);
        foreach ($counts as $count) {
            $line = $inventory->lines()->where('article_id', $count['article_id'])->first();
            if (! $line) {
                throw ValidationException::withMessages(['counts' => 'Un article ne fait pas partie de cet inventaire.']);
            }
            $line->update([
                'counted_quantity' => $count['counted_quantity'] === null || $count['counted_quantity'] === '' ? null : round((float) $count['counted_quantity'], 2),
                'note' => $count['note'] ?? $line->note,
            ]);
        }

        return $inventory;
    }

    public function validate(Inventory $inventory, User $by): Inventory
    {
        $this->ensureOpen($inventory);
        $lines = $inventory->lines()->with('article')->whereNotNull('counted_quantity')->get();
        if ($lines->isEmpty()) {
            throw ValidationException::withMessages(['inventory' => 'Aucun article compté.']);
        }

        return DB::transaction(function () use ($inventory, $lines, $by) {
            $total = 0;
            foreach ($lines as $line) {
                $expected = (float) Article::query()->whereKey($line->article_id)->value('quantity');
                $movement = $this->stock->adjustTo($line->article, $line->counted_quantity, StockMovementType::Inventaire, [
                    'inventory_id' => $inventory->id, 'moved_on' => $inventory->counted_on->toDateString(), 'reason' => "Inventaire {$inventory->number}",
                ], $by);
                $line->update([
                    'expected_quantity' => $expected,
                    'difference' => round($line->counted_quantity - $expected, 2),
                    'value_difference' => $movement?->value ?? 0,
                ]);
                $total += $movement?->value ?? 0;
            }
            $inventory->forceFill(['status' => 'valide', 'value_difference' => $total, 'validated_at' => now(), 'validated_by' => $by->id])->save();

            return $inventory;
        });
    }

    public function discard(Inventory $inventory): void
    {
        $this->ensureOpen($inventory);
        $inventory->delete();
    }

    private function ensureOpen(Inventory $inventory): void
    {
        if ($inventory->isValidated()) {
            throw ValidationException::withMessages(['inventory' => 'Cet inventaire est validé : il ne se modifie plus.']);
        }
    }
}
