<?php

namespace App\Models;

use App\Enums\Activity;
use App\Enums\InvoiceStatus;
use App\Enums\InvoiceType;
use App\Enums\PaymentState;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Facture ou avoir. Brouillon : modifiable, supprimable, sans numéro. Émise : numérotée sans trou,
 * figée ; on la corrige par un avoir. Voir App\Services\Billing.
 */
#[Fillable(['type', 'client_id', 'property_id', 'activity', 'credited_invoice_id', 'issue_date', 'due_date', 'notes', 'created_by'])]
class Invoice extends Model
{
    use LogsActivity, SoftDeletes;

    protected $attributes = [
        'type' => 'facture',
        'status' => 'brouillon',
        'activity' => 'immobilier',
    ];

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'reminder_level' => 'integer',
            'last_reminded_at' => 'datetime',
            'type' => InvoiceType::class,
            'status' => InvoiceStatus::class,
            'activity' => Activity::class,
            'issue_date' => 'date',
            'due_date' => 'date',
            'issued_at' => 'datetime',
            'subtotal' => 'integer',
            'vat_total' => 'integer',
            'total' => 'integer',
            'paid_total' => 'integer',
            'credited_total' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<Client, $this>
     */
    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class)->withTrashed();
    }

    /**
     * @return BelongsTo<Property, $this>
     */
    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class)->withTrashed();
    }

    /**
     * @return HasMany<InvoiceLine, $this>
     */
    public function lines(): HasMany
    {
        return $this->hasMany(InvoiceLine::class)->orderBy('position')->orderBy('id');
    }

    /**
     * @return HasMany<Payment, $this>
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class)->latest('paid_on')->latest('id');
    }

    /**
     * Facture corrigée par cet avoir.
     *
     * @return BelongsTo<Invoice, $this>
     */
    public function creditedInvoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class, 'credited_invoice_id');
    }

    /**
     * Avoirs émis ou en préparation sur cette facture.
     *
     * @return HasMany<Invoice, $this>
     */
    public function creditNotes(): HasMany
    {
        return $this->hasMany(Invoice::class, 'credited_invoice_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isDraft(): bool
    {
        return $this->status === InvoiceStatus::Brouillon;
    }

    public function isCreditNote(): bool
    {
        return $this->type === InvoiceType::Avoir;
    }

    /**
     * Reste à payer : total − avoirs − encaissements. Négatif = trop-perçu à rembourser.
     */
    public function balance(): int
    {
        if ($this->isDraft() || $this->isCreditNote()) {
            return 0;
        }

        return $this->total - $this->credited_total - $this->paid_total;
    }

    public function paymentState(): ?PaymentState
    {
        if ($this->isDraft() || $this->isCreditNote()) {
            return null;
        }

        if ($this->credited_total >= $this->total && $this->paid_total === 0) {
            return PaymentState::Annulee;
        }

        return match (true) {
            $this->balance() <= 0 => PaymentState::Payee,
            $this->paid_total > 0 => PaymentState::Partielle,
            default => PaymentState::NonPayee,
        };
    }

    public function isOverdue(): bool
    {
        return $this->balance() > 0 && $this->due_date !== null && $this->due_date->lt(today());
    }

    /**
     * Factures émises qui restent à payer.
     *
     * @param  Builder<Invoice>  $query
     */
    public function scopeOutstanding(Builder $query): void
    {
        $query->where('type', InvoiceType::Facture)
            ->where('status', InvoiceStatus::Emise)
            ->whereRaw('total - credited_total - paid_total > 0');
    }

    /**
     * @param  Builder<Invoice>  $query
     */
    public function scopeOverdue(Builder $query): void
    {
        $query->outstanding()->whereDate('due_date', '<', today());
    }

    /**
     * Appel de loyer dont cette facture est la facture du mois (le cas échéant).
     *
     * @return HasOne<RentCall, $this>
     */
    public function rentCall(): HasOne
    {
        return $this->hasOne(RentCall::class);
    }
}
