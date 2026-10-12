<?php

namespace App\Models;

use App\Enums\InspectionType;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * État des lieux d'entrée ou de sortie d'un bail : relevé pièce par pièce, compteurs, clés, photos.
 * Une fois validé, il est figé (App\Services\InspectionService).
 */
#[Fillable([
    'lease_id', 'type', 'inspected_on', 'inspector_id', 'tenant_present', 'electricity_meter', 'water_meter',
    'keys_count', 'general_comment', 'created_by',
])]
class LeaseInspection extends Model
{
    use LogsActivity;

    protected $attributes = [
        'tenant_present' => true,
    ];

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'type' => InspectionType::class,
            'inspected_on' => 'immutable_date',
            'tenant_present' => 'boolean',
            'keys_count' => 'integer',
            'validated_at' => 'immutable_datetime',
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
     * @return BelongsTo<User, $this>
     */
    public function inspector(): BelongsTo
    {
        return $this->belongsTo(User::class, 'inspector_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function validator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'validated_by');
    }

    /**
     * @return HasMany<LeaseInspectionItem, $this>
     */
    public function items(): HasMany
    {
        return $this->hasMany(LeaseInspectionItem::class)->orderBy('position')->orderBy('id');
    }

    /**
     * @return HasMany<LeaseInspectionPhoto, $this>
     */
    public function photos(): HasMany
    {
        return $this->hasMany(LeaseInspectionPhoto::class)->orderBy('id');
    }

    public function isValidated(): bool
    {
        return $this->validated_at !== null;
    }
}
