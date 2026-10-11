<?php

namespace App\Models;

use App\Enums\PaymentMethod;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Encaissement d'une facture, avec son reçu numéroté (REC-AAAA-00001). Jamais supprimé :
 * une erreur s'annule avec un motif.
 */
#[Fillable(['number', 'invoice_id', 'client_id', 'method', 'amount', 'paid_on', 'reference', 'proof_path', 'note', 'received_by', 'cash_session_id', 'owner_payout_id'])]
class Payment extends Model
{
    use LogsActivity;

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'method' => PaymentMethod::class,
            'amount' => 'integer',
            'paid_on' => 'date',
            'cancelled_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Invoice, $this>
     */
    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    /**
     * @return BelongsTo<Client, $this>
     */
    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class)->withTrashed();
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function receiver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'received_by');
    }

    /**
     * Reversement au propriétaire qui inclut ce loyer (baux gérés).
     *
     * @return BelongsTo<OwnerPayout, $this>
     */
    public function ownerPayout(): BelongsTo
    {
        return $this->belongsTo(OwnerPayout::class);
    }

    /**
     * @return BelongsTo<CashSession, $this>
     */
    public function cashSession(): BelongsTo
    {
        return $this->belongsTo(CashSession::class);
    }

    public function isCancelled(): bool
    {
        return $this->cancelled_at !== null;
    }

    /**
     * @param  Builder<Payment>  $query
     */
    public function scopeValid(Builder $query): void
    {
        $query->whereNull('cancelled_at');
    }
}
