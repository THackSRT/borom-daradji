<?php

namespace App\Models;

use App\Enums\PaymentMethod;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Paiement d'un achat au fournisseur. En espèces, il sort de la caisse du jour. Jamais supprimé :
 * annulé avec un motif.
 */
#[Fillable(['purchase_id', 'amount', 'paid_on', 'method', 'reference', 'note', 'cash_movement_id', 'paid_by'])]
class SupplierPayment extends Model
{
    use LogsActivity;

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return ['amount' => 'integer', 'paid_on' => 'immutable_date', 'method' => PaymentMethod::class, 'cancelled_at' => 'datetime'];
    }

    /**
     * @return BelongsTo<Purchase, $this>
     */
    public function purchase(): BelongsTo
    {
        return $this->belongsTo(Purchase::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function payer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'paid_by');
    }

    /**
     * @return BelongsTo<CashMovement, $this>
     */
    public function cashMovement(): BelongsTo
    {
        return $this->belongsTo(CashMovement::class);
    }

    public function isCancelled(): bool
    {
        return $this->cancelled_at !== null;
    }
}
