<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Ligne d'un lot de devis : copie de la prestation du catalogue au moment de la saisie (le prix du
 * catalogue peut changer ensuite sans modifier le devis).
 */
#[Fillable(['catalog_item_id', 'designation', 'unit', 'quantity', 'unit_price', 'vat_rate', 'amount', 'net_amount', 'vat_amount', 'position'])]
class QuoteLine extends Model
{
    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'unit_price' => 'integer',
            'vat_rate' => 'decimal:2',
            'amount' => 'integer',
            'net_amount' => 'integer',
            'vat_amount' => 'integer',
            'position' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<QuoteLot, $this>
     */
    public function lot(): BelongsTo
    {
        return $this->belongsTo(QuoteLot::class, 'quote_lot_id');
    }
}
