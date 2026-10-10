<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Appel de loyer d'un mois : le lien entre un bail et la facture du mois. Pas de journal propre :
 * la facture est journalisée.
 */
#[Fillable(['lease_id', 'period', 'invoice_id'])]
class RentCall extends Model
{
    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return ['period' => 'immutable_date'];
    }

    /**
     * @return BelongsTo<Lease, $this>
     */
    public function lease(): BelongsTo
    {
        return $this->belongsTo(Lease::class);
    }

    /**
     * @return BelongsTo<Invoice, $this>
     */
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    /**
     * Quittance possible : le mois est entièrement payé.
     */
    public function isPaid(): bool
    {
        return ! $this->invoice->isDraft() && $this->invoice->paid_total > 0 && $this->invoice->balance() <= 0;
    }
}
