<?php

namespace App\Models;

use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Achat à un fournisseur : la marchandise reçue entre en stock à l'enregistrement (bon d'entrée
 * `ACH-AAAA-0001`). Jamais supprimé : annulé avec un motif (la marchandise ressort du stock).
 */
#[Fillable(['supplier_id', 'supplier_reference', 'received_on', 'due_date', 'notes', 'created_by'])]
class Purchase extends Model
{
    use LogsActivity;

    protected $attributes = ['subtotal' => 0, 'vat_total' => 0, 'total' => 0, 'paid_total' => 0];

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'received_on' => 'immutable_date',
            'due_date' => 'immutable_date',
            'subtotal' => 'integer',
            'vat_total' => 'integer',
            'total' => 'integer',
            'paid_total' => 'integer',
            'cancelled_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Client, $this>
     */
    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'supplier_id')->withTrashed();
    }

    /**
     * @return HasMany<PurchaseLine, $this>
     */
    public function lines(): HasMany
    {
        return $this->hasMany(PurchaseLine::class)->orderBy('id');
    }

    /**
     * @return HasMany<SupplierPayment, $this>
     */
    public function payments(): HasMany
    {
        return $this->hasMany(SupplierPayment::class)->orderBy('paid_on')->orderBy('id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isCancelled(): bool
    {
        return $this->cancelled_at !== null;
    }

    public function balance(): int
    {
        return $this->isCancelled() ? 0 : max(0, $this->total - $this->paid_total);
    }

    /**
     * @param  Builder<Purchase>  $query
     */
    public function scopeValid(Builder $query): void
    {
        $query->whereNull('cancelled_at');
    }

    /**
     * Achats valides pas encore entièrement payés.
     *
     * @param  Builder<Purchase>  $query
     */
    public function scopeUnpaid(Builder $query): void
    {
        $query->whereNull('cancelled_at')->whereColumn('paid_total', '<', 'total');
    }
}
