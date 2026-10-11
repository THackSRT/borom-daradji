<?php

namespace App\Models;

use App\Enums\PaymentMethod;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Restitution de la caution en fin de bail : caution encaissée, loyers impayés et réparations retenus,
 * montant rendu au locataire (ou reste dû, facturé). Voir App\Services\DepositService.
 */
#[Fillable([
    'number', 'lease_id', 'exit_inspection_id', 'deposit_held', 'arrears_retained', 'deductions_total', 'deductions',
    'refund', 'balance_due', 'balance_invoice_id', 'refund_method', 'refund_reference', 'settled_on',
    'cash_movement_id', 'note', 'created_by',
])]
class DepositSettlement extends Model
{
    use LogsActivity;

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'deposit_held' => 'integer',
            'arrears_retained' => 'integer',
            'deductions_total' => 'integer',
            'deductions' => 'array',
            'refund' => 'integer',
            'balance_due' => 'integer',
            'refund_method' => PaymentMethod::class,
            'settled_on' => 'immutable_date',
            'cancelled_at' => 'immutable_datetime',
        ];
    }

    /**
     * @return BelongsTo<Lease, $this>
     */
    public function lease(): BelongsTo
    {
        return $this->belongsTo(Lease::class);
    }

    /**
     * @return BelongsTo<LeaseInspection, $this>
     */
    public function exitInspection(): BelongsTo
    {
        return $this->belongsTo(LeaseInspection::class, 'exit_inspection_id');
    }

    /**
     * @return BelongsTo<Invoice, $this>
     */
    public function balanceInvoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class, 'balance_invoice_id');
    }

    /**
     * Loyers impayés retenus sur la caution.
     *
     * @return HasMany<Payment, $this>
     */
    public function retainedPayments(): HasMany
    {
        return $this->hasMany(Payment::class);
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

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
