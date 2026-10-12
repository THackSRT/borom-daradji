<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Lien entre un chantier et une de ses factures (acompte, situation n, solde), avec les cumuls qui
 * servent à calculer la suivante. Pas de journal propre : la facture est journalisée.
 */
#[Fillable(['invoice_id', 'kind', 'sequence', 'cumulative_ht', 'deposit_ht', 'deposit_deducted_ht', 'lots', 'created_by'])]
class WorksiteInvoice extends Model
{
    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'sequence' => 'integer',
            'cumulative_ht' => 'integer',
            'deposit_ht' => 'integer',
            'deposit_deducted_ht' => 'integer',
            'lots' => 'array',
        ];
    }

    /**
     * @return BelongsTo<Worksite, $this>
     */
    public function worksite(): BelongsTo
    {
        return $this->belongsTo(Worksite::class);
    }

    /**
     * @return BelongsTo<Invoice, $this>
     */
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class)->withTrashed();
    }

    /**
     * Compte dans les cumuls : facture ni supprimée (brouillon abandonné) ni annulée par un avoir total.
     */
    public function counts(): bool
    {
        $invoice = $this->invoice;

        return $invoice !== null && ! $invoice->trashed() && ! ($invoice->credited_total >= $invoice->total && $invoice->total > 0);
    }
}
