<?php

namespace App\Models;

use App\Enums\LandStatus;
use App\Enums\PropertyCheckItem;
use App\Enums\PropertyStatus;
use App\Enums\PropertyType;
use App\Enums\TransactionType;
use App\Models\Concerns\LogsActivity;
use App\Support\Sequence;
use Database\Factories\PropertyFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

#[Fillable([
    'title', 'type', 'transaction', 'price', 'charges', 'deposit_months', 'advance_months',
    'surface', 'land_surface', 'rooms', 'bedrooms', 'bathrooms', 'features', 'city', 'neighborhood',
    'address', 'latitude', 'longitude', 'description', 'land_status', 'land_reference',
    'owner_id', 'agent_id', 'is_featured',
])]
class Property extends Model
{
    /** @use HasFactory<PropertyFactory> */
    use HasFactory, LogsActivity, SoftDeletes;

    protected $attributes = [
        'status' => 'brouillon',
        'land_status' => 'inconnu',
        'features' => '[]',
        'is_featured' => false,
    ];

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'type' => PropertyType::class,
            'transaction' => TransactionType::class,
            'status' => PropertyStatus::class,
            'land_status' => LandStatus::class,
            'price' => 'integer',
            'charges' => 'integer',
            'features' => 'array',
            'latitude' => 'float',
            'longitude' => 'float',
            'is_featured' => 'boolean',
            'published_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Property $property) {
            $property->reference ??= sprintf('BD-%d-%04d', now()->year, Sequence::next('property'));
            $property->slug ??= Str::slug(Str::limit($property->title, 80, '')).'-'.Str::lower($property->reference);
        });

        static::created(function (Property $property) {
            foreach (PropertyCheckItem::cases() as $item) {
                // Liste créée vide : inutile de journaliser 6 lignes « à faire ».
                $property->checks()->createQuietly(['item' => $item]);
            }
        });
    }

    /**
     * @return BelongsTo<Client, $this>
     */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'owner_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function agent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'agent_id');
    }

    /**
     * @return HasMany<PropertyPhoto, $this>
     */
    public function photos(): HasMany
    {
        return $this->hasMany(PropertyPhoto::class)->orderBy('position')->orderBy('id');
    }

    /**
     * @return HasOne<PropertyPhoto, $this>
     */
    public function cover(): HasOne
    {
        return $this->hasOne(PropertyPhoto::class)->where('is_cover', true);
    }

    /**
     * @return HasMany<PropertyDocument, $this>
     */
    public function documents(): HasMany
    {
        return $this->hasMany(PropertyDocument::class);
    }

    /**
     * @return HasMany<PropertyCheck, $this>
     */
    public function checks(): HasMany
    {
        return $this->hasMany(PropertyCheck::class);
    }

    /**
     * @return HasMany<PropertyStatusChange, $this>
     */
    public function statusChanges(): HasMany
    {
        return $this->hasMany(PropertyStatusChange::class)->latest('created_at')->latest('id');
    }

    /**
     * @return HasMany<Mandate, $this>
     */
    public function mandates(): HasMany
    {
        return $this->hasMany(Mandate::class)->latest('starts_on');
    }

    /**
     * @return HasMany<Visit, $this>
     */
    public function visits(): HasMany
    {
        return $this->hasMany(Visit::class)->latest('scheduled_at');
    }

    /**
     * Points de vérification qui empêchent la publication.
     *
     * @return Collection<int, PropertyCheck>
     */
    public function blockingChecks(): Collection
    {
        return $this->checks()->get()->reject(fn (PropertyCheck $check) => $check->isCleared())->values();
    }

    /**
     * @param  Builder<Property>  $query
     */
    public function scopePublished(Builder $query): void
    {
        $query->whereIn('status', PropertyStatus::public());
    }
}
