<?php

namespace App\Models;

use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Prestation du catalogue : désignation, unité, prix unitaire HT. Désactivée plutôt que supprimée
 * (les devis gardent leur copie de la ligne).
 */
#[Fillable(['trade_id', 'designation', 'unit', 'unit_price', 'vat_rate', 'description', 'is_active'])]
class CatalogItem extends Model
{
    use LogsActivity;

    protected $attributes = ['is_active' => true];

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return ['unit_price' => 'integer', 'vat_rate' => 'decimal:2', 'is_active' => 'boolean'];
    }

    /**
     * @return BelongsTo<Trade, $this>
     */
    public function trade(): BelongsTo
    {
        return $this->belongsTo(Trade::class);
    }
}
