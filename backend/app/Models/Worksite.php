<?php

namespace App\Models;

use App\Enums\WorksiteStatus;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Chantier : créé à l'acceptation d'un devis (ou à la main, au stade du devis), suivi par lots avec un
 * pourcentage d'avancement, un journal et des photos. Voir App\Services\WorksiteService.
 */
#[Fillable([
    'client_id', 'property_id', 'quote_id', 'title', 'address', 'latitude', 'longitude', 'manager_id',
    'start_date', 'planned_end_date', 'budget_materials', 'budget_labor', 'budget_other', 'notes', 'created_by',
])]
class Worksite extends Model
{
    use LogsActivity, SoftDeletes;

    protected $attributes = [
        'status' => 'planifie',
        'contract_ht' => 0,
        'contract_total' => 0,
        'budget_materials' => 0,
        'budget_labor' => 0,
        'budget_other' => 0,
    ];

    /** Le jeton du lien de suivi ne sort ni dans les réponses brutes ni dans le journal. */
    protected $hidden = ['tracking_token'];

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'status' => WorksiteStatus::class,
            'latitude' => 'float',
            'longitude' => 'float',
            'start_date' => 'immutable_date',
            'planned_end_date' => 'immutable_date',
            'actual_end_date' => 'immutable_date',
            'contract_ht' => 'integer',
            'contract_total' => 'integer',
            'budget_materials' => 'integer',
            'budget_labor' => 'integer',
            'budget_other' => 'integer',
            'budget_alerted_at' => 'datetime',
            'tracking_enabled_at' => 'datetime',
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
     * @return BelongsTo<Quote, $this>
     */
    public function quote(): BelongsTo
    {
        return $this->belongsTo(Quote::class)->withTrashed();
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function manager(): BelongsTo
    {
        return $this->belongsTo(User::class, 'manager_id');
    }

    /**
     * @return HasMany<WorksiteLot, $this>
     */
    public function lots(): HasMany
    {
        return $this->hasMany(WorksiteLot::class)->orderBy('position')->orderBy('id');
    }

    /**
     * @return HasMany<WorksiteLog, $this>
     */
    public function logs(): HasMany
    {
        return $this->hasMany(WorksiteLog::class)->latest('logged_on')->latest('id');
    }

    /**
     * @return HasMany<WorksitePhoto, $this>
     */
    public function photos(): HasMany
    {
        return $this->hasMany(WorksitePhoto::class)->latest('taken_at')->latest('id');
    }

    /**
     * Avancement global, pondéré par le montant des lots (moyenne simple si aucun montant).
     */
    public function progress(): int
    {
        $lots = $this->relationLoaded('lots') ? $this->lots : $this->lots()->get();
        if ($lots->isEmpty()) {
            return 0;
        }
        $total = $lots->sum('amount_ht');

        return (int) round($total > 0
            ? $lots->sum(fn (WorksiteLot $l) => $l->amount_ht * $l->progress) / $total
            : $lots->avg('progress'));
    }

    public function budgetTotal(): int
    {
        return $this->budget_materials + $this->budget_labor + $this->budget_other;
    }

    /**
     * @param  Builder<Worksite>  $query
     */
    public function scopeOpen(Builder $query): void
    {
        $query->whereIn('status', [WorksiteStatus::Planifie, WorksiteStatus::EnCours, WorksiteStatus::Suspendu]);
    }
}
