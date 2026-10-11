<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Ligne de facture. Pas de journal propre : les lignes ne changent que dans un brouillon,
 * et la facture journalise ses totaux. Montant et TVA arrondis au franc par ligne.
 */
#[Fillable(['position', 'description', 'quantity', 'unit', 'unit_price', 'vat_rate', 'amount', 'vat_amount'])]
class InvoiceLine extends Model
{
    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'vat_rate' => 'decimal:2',
            'unit_price' => 'integer',
            'amount' => 'integer',
            'vat_amount' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<Invoice, $this>
     */
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }
}
