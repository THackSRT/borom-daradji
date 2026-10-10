<?php

namespace App\Models;

use App\Enums\LeaseStatus;
use App\Models\Concerns\LogsActivity;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Collection;

/**
 * Bail : un bien, un locataire, un loyer mensuel. Chaque mois, un appel de loyer (facture) est émis
 * par App\Services\RentService ; si le bail est « géré », les loyers encaissés sont reversés au
 * propriétaire, moins la commission.
 */
#[Fillable([
    'property_id', 'tenant_id', 'owner_id', 'agent_id', 'start_date', 'end_date', 'billing_start',
    'rent', 'charges', 'deposit', 'advance_months', 'due_day', 'rent_vat_rate', 'managed', 'commission_rate',
    'notes', 'created_by',
])]
class Lease extends Model
{
    use LogsActivity;

    protected $attributes = [
        'status' => 'actif',
        'charges' => 0,
        'deposit' => 0,
        'advance_months' => 0,
        'managed' => false,
        'commission_rate' => 0,
    ];

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'status' => LeaseStatus::class,
            'start_date' => 'immutable_date',
            'end_date' => 'immutable_date',
            'billing_start' => 'immutable_date',
            'terminated_on' => 'immutable_date',
            'rent' => 'integer',
            'charges' => 'integer',
            'deposit' => 'integer',
            'advance_months' => 'integer',
            'due_day' => 'integer',
            'rent_vat_rate' => 'decimal:2',
            'managed' => 'boolean',
            'commission_rate' => 'decimal:2',
        ];
    }

    /**
     * @return BelongsTo<Property, $this>
     */
    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class)->withTrashed();
    }

    /**
     * @return BelongsTo<Client, $this>
     */
    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'tenant_id')->withTrashed();
    }

    /**
     * @return BelongsTo<Client, $this>
     */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'owner_id')->withTrashed();
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function agent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'agent_id');
    }

    /**
     * @return BelongsTo<Invoice, $this>
     */
    public function entryInvoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class, 'entry_invoice_id');
    }

    /**
     * @return HasMany<RentCall, $this>
     */
    public function rentCalls(): HasMany
    {
        return $this->hasMany(RentCall::class)->orderByDesc('period');
    }

    /**
     * @return HasMany<LeaseInspection, $this>
     */
    public function inspections(): HasMany
    {
        return $this->hasMany(LeaseInspection::class)->orderBy('type');
    }

    /**
     * @return HasOne<DepositSettlement, $this>
     */
    public function depositSettlement(): HasOne
    {
        return $this->hasOne(DepositSettlement::class);
    }

    public function isActive(): bool
    {
        return $this->status === LeaseStatus::Actif;
    }

    /**
     * Dernier mois facturable : fin du bail ou résiliation.
     */
    public function lastBillableMonth(): ?CarbonImmutable
    {
        $ends = array_filter([$this->end_date, $this->terminated_on]);

        return $ends ? min($ends)->startOfMonth() : null;
    }

    /**
     * Loyers échus et non payés (appels de loyer dont l'échéance est passée).
     */
    public function arrears(): int
    {
        return (int) $this->overdueCalls()->sum(fn (RentCall $call) => max(0, $call->invoice->balance()));
    }

    /**
     * @return Collection<int, RentCall>
     */
    public function overdueCalls(): Collection
    {
        $calls = $this->relationLoaded('rentCalls') ? $this->rentCalls : $this->rentCalls()->with('invoice')->get();

        return $calls->filter(fn (RentCall $call) => $call->invoice->isOverdue())->values();
    }

    /**
     * Caution réellement encaissée. Facture d'entrée : ses encaissements couvrent d'abord la caution
     * (première ligne). Sans facture d'entrée (bail saisi après coup), la caution prévue au bail est
     * réputée reçue. Proposée par défaut à la restitution, modifiable.
     */
    public function depositCollected(): int
    {
        if (! $this->entry_invoice_id) {
            return $this->deposit;
        }
        $invoice = $this->entryInvoice;
        if (! $invoice || $invoice->isDraft()) {
            return 0;
        }

        return max(0, min($this->deposit, $invoice->paid_total));
    }

    /**
     * Appels de loyer émis et pas entièrement payés (échus ou non), du plus ancien au plus récent.
     *
     * @return Collection<int, RentCall>
     */
    public function unpaidCalls(): Collection
    {
        return $this->rentCalls()->with('invoice')->get()
            ->filter(fn (RentCall $call) => ! $call->invoice->isDraft() && $call->invoice->balance() > 0)
            ->sortBy(fn (RentCall $call) => $call->period)
            ->values();
    }

    /**
     * @param  Builder<Lease>  $query
     */
    public function scopeActive(Builder $query): void
    {
        $query->where('status', LeaseStatus::Actif);
    }
}
