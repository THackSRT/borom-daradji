<?php

namespace App\Models;

use App\Enums\PaymentMethod;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Reversement au propriétaire : relevé figé (loyers encaissés, commission, frais) et versement.
 */
#[Fillable([
    'number', 'owner_id', 'period', 'collected', 'commission', 'commission_vat', 'expenses', 'net', 'details',
    'method', 'reference', 'paid_on', 'note', 'created_by',
])]
class OwnerPayout extends Model
{
    use LogsActivity;

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'period' => 'immutable_date',
            'paid_on' => 'date',
            'details' => 'array',
            'method' => PaymentMethod::class,
            'collected' => 'integer',
            'commission' => 'integer',
            'commission_vat' => 'integer',
            'expenses' => 'integer',
            'net' => 'integer',
            'cancelled_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Client, $this>
     */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'owner_id')->withTrashed();
    }

    /**
     * @return HasMany<Payment, $this>
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function isCancelled(): bool
    {
        return $this->cancelled_at !== null;
    }
}
