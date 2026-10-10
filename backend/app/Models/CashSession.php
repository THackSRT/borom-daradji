<?php

namespace App\Models;

use App\Enums\PaymentMethod;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Caisse d'une personne pour une journée : fonds de départ, espèces encaissées, mouvements,
 * puis comptage à la clôture et écart.
 */
#[Fillable(['user_id', 'date', 'opening_amount'])]
class CashSession extends Model
{
    use LogsActivity;

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'date' => 'date',
            'opening_amount' => 'integer',
            'expected_amount' => 'integer',
            'counted_amount' => 'integer',
            'difference' => 'integer',
            'closed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return HasMany<Payment, $this>
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class)->latest('id');
    }

    /**
     * @return HasMany<CashMovement, $this>
     */
    public function movements(): HasMany
    {
        return $this->hasMany(CashMovement::class)->latest('id');
    }

    public function isClosed(): bool
    {
        return $this->closed_at !== null;
    }

    public function cashIn(): int
    {
        return (int) $this->payments()->valid()->where('method', PaymentMethod::Especes)->sum('amount');
    }

    public function movementsTotal(): int
    {
        return $this->movements()->get()->sum(fn (CashMovement $m) => $m->type->sign() * $m->amount);
    }

    /**
     * Espèces qui devraient se trouver dans la caisse.
     */
    public function expected(): int
    {
        return $this->opening_amount + $this->cashIn() + $this->movementsTotal();
    }
}
