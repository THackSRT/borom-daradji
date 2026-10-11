<?php

namespace App\Models;

use App\Enums\QuoteStatus;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Devis de travaux, organisé en lots (un lot par corps de métier, en général). Totaux calculés par
 * App\Services\QuoteService. Un modèle (`is_template`) sert de point de départ à de nouveaux devis.
 */
#[Fillable([
    'is_template', 'template_name', 'client_id', 'property_id', 'title', 'site_address', 'discount_rate',
    'deposit_rate', 'conditions', 'notes', 'created_by',
])]
class Quote extends Model
{
    use LogsActivity, SoftDeletes;

    protected $attributes = [
        'status' => 'brouillon',
        'is_template' => false,
        'discount_rate' => 0,
        'deposit_rate' => 0,
    ];

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'status' => QuoteStatus::class,
            'is_template' => 'boolean',
            'issue_date' => 'immutable_date',
            'valid_until' => 'immutable_date',
            'discount_rate' => 'decimal:2',
            'deposit_rate' => 'decimal:2',
            'subtotal' => 'integer',
            'discount_amount' => 'integer',
            'total_ht' => 'integer',
            'vat_total' => 'integer',
            'total' => 'integer',
            'sent_at' => 'immutable_datetime',
            'decided_at' => 'immutable_datetime',
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
     * @return BelongsTo<Worksite, $this>
     */
    public function worksite(): BelongsTo
    {
        return $this->belongsTo(Worksite::class)->withTrashed();
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * @return HasMany<QuoteLot, $this>
     */
    public function lots(): HasMany
    {
        return $this->hasMany(QuoteLot::class)->orderBy('position')->orderBy('id');
    }

    /**
     * @return HasManyThrough<QuoteLine, QuoteLot, $this>
     */
    public function lines(): HasManyThrough
    {
        return $this->hasManyThrough(QuoteLine::class, QuoteLot::class);
    }

    public function isDraft(): bool
    {
        return $this->status === QuoteStatus::Brouillon;
    }

    /** Acompte demandé à la commande, TTC. */
    public function depositAmount(): int
    {
        return (int) round($this->total * (float) $this->deposit_rate / 100);
    }

    /**
     * @param  Builder<Quote>  $query
     */
    public function scopeQuotes(Builder $query): void
    {
        $query->where('is_template', false);
    }

    /**
     * @param  Builder<Quote>  $query
     */
    public function scopeTemplates(Builder $query): void
    {
        $query->where('is_template', true);
    }
}
