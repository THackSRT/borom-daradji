<?php

namespace App\Models;

use App\Enums\StockMovementType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Mouvement de stock : jamais modifié ni supprimé (une erreur se corrige par le mouvement inverse).
 * Garde la quantité et le coût moyen après le mouvement, pour l'historique de l'article.
 */
#[Fillable([
    'article_id', 'type', 'quantity', 'unit_cost', 'value', 'quantity_after', 'average_cost_after', 'moved_on', 'reason',
    'worksite_id', 'purchase_id', 'invoice_id', 'inventory_id', 'reverses_id', 'created_by',
])]
class StockMovement extends Model
{
    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'type' => StockMovementType::class,
            'quantity' => 'float',
            'unit_cost' => 'float',
            'value' => 'integer',
            'quantity_after' => 'float',
            'average_cost_after' => 'float',
            'moved_on' => 'immutable_date',
        ];
    }

    /**
     * @return BelongsTo<Article, $this>
     */
    public function article(): BelongsTo
    {
        return $this->belongsTo(Article::class);
    }

    /**
     * @return BelongsTo<Worksite, $this>
     */
    public function worksite(): BelongsTo
    {
        return $this->belongsTo(Worksite::class)->withTrashed();
    }

    /**
     * @return BelongsTo<Purchase, $this>
     */
    public function purchase(): BelongsTo
    {
        return $this->belongsTo(Purchase::class);
    }

    /**
     * @return BelongsTo<Invoice, $this>
     */
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class)->withTrashed();
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
