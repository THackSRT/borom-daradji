<?php

namespace App\Services;

use App\Enums\StockMovementType;
use App\Models\Article;
use App\Models\StockMovement;
use App\Models\User;
use App\Models\Worksite;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Sorties de stock hors vente : vers un chantier (le coût est imputé au chantier) et retours, pertes et
 * casse (motif obligatoire), corrections ponctuelles.
 */
class StockOperations
{
    public function __construct(private StockService $stock, private WorksiteCosts $costs) {}

    /**
     * Bon de sortie vers un chantier ouvert : chaque article sort au CMUP du moment.
     *
     * @param  list<array{article_id: int, quantity: float|int|string}>  $lines
     * @return list<StockMovement>
     */
    public function toWorksite(Worksite $worksite, array $lines, ?string $date, ?string $note, User $by): array
    {
        app(WorksiteService::class)->ensureOpen($worksite);

        $movements = DB::transaction(fn () => array_map(fn (array $line) => $this->stock->issue(
            Article::query()->findOrFail($line['article_id']),
            round((float) $line['quantity'], 2),
            StockMovementType::SortieChantier,
            ['worksite_id' => $worksite->id, 'moved_on' => $date, 'reason' => $note ?: "Chantier {$worksite->reference}"],
            $by,
        ), $lines));
        $this->costs->checkAlert($worksite);

        return $movements;
    }

    /**
     * Retour au dépôt de matériaux non utilisés : au coût auquel ils étaient sortis, sans dépasser ce
     * qui est parti sur ce chantier.
     */
    public function returnFromWorksite(Worksite $worksite, Article $article, float $quantity, ?string $note, User $by): StockMovement
    {
        $net = StockMovement::query()->where('article_id', $article->id)->where('worksite_id', $worksite->id)
            ->whereIn('type', [StockMovementType::SortieChantier, StockMovementType::RetourChantier])
            ->selectRaw('coalesce(sum(quantity), 0) as qty, coalesce(sum(value), 0) as val')->first();
        $outQty = -(float) $net->qty;
        if (round($quantity, 2) > round($outQty, 2)) {
            throw ValidationException::withMessages(['quantity' => 'Seulement '.StockService::qty(max(0, $outQty))." {$article->unit} sortis vers ce chantier."]);
        }
        $unitCost = $outQty > 0 ? -(float) $net->val / $outQty : $article->average_cost;

        return $this->stock->receive($article, round($quantity, 2), $unitCost, StockMovementType::RetourChantier, [
            'worksite_id' => $worksite->id, 'reason' => $note ?: "Retour du chantier {$worksite->reference}",
        ], $by);
    }

    public function loss(Article $article, float $quantity, string $reason, ?string $date, User $by): StockMovement
    {
        return $this->stock->issue($article, round($quantity, 2), StockMovementType::Perte, ['reason' => $reason, 'moved_on' => $date], $by);
    }

    /** Correction ponctuelle à la quantité constatée (hors inventaire complet), avec motif. */
    public function correct(Article $article, float $counted, string $reason, User $by): ?StockMovement
    {
        return $this->stock->adjustTo($article, round($counted, 2), StockMovementType::Ajustement, ['reason' => $reason], $by);
    }
}
