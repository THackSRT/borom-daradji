<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Ligne d'inventaire : quantité comptée ; à la validation, stock théorique, écart et sa valeur.
 */
#[Fillable(['article_id', 'counted_quantity', 'expected_quantity', 'difference', 'value_difference', 'note'])]
class InventoryLine extends Model
{
    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return ['counted_quantity' => 'float', 'expected_quantity' => 'float', 'difference' => 'float', 'value_difference' => 'integer'];
    }

    /**
     * @return BelongsTo<Article, $this>
     */
    public function article(): BelongsTo
    {
        return $this->belongsTo(Article::class);
    }

    /**
     * @return BelongsTo<Inventory, $this>
     */
    public function inventory(): BelongsTo
    {
        return $this->belongsTo(Inventory::class);
    }
}
