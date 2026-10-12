<?php

namespace App\Models;

use App\Enums\CheckStatus;
use App\Enums\PropertyCheckItem;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Un point de la vérification foncière d'un bien.
 */
#[Fillable(['item', 'status', 'note', 'document_id', 'checked_by', 'checked_at'])]
class PropertyCheck extends Model
{
    use LogsActivity;

    protected $attributes = [
        'status' => 'a_faire',
    ];

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'item' => PropertyCheckItem::class,
            'status' => CheckStatus::class,
            'checked_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Property, $this>
     */
    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    /**
     * @return BelongsTo<PropertyDocument, $this>
     */
    public function document(): BelongsTo
    {
        return $this->belongsTo(PropertyDocument::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function checker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'checked_by');
    }

    /**
     * Un état des droits réels trop ancien doit être redemandé à la Conservation foncière.
     */
    public function isExpired(): bool
    {
        return $this->item === PropertyCheckItem::EtatDroitsReels
            && $this->status === CheckStatus::Ok
            && $this->checked_at !== null
            && $this->checked_at->lt(now()->subDays(config('borom.land_check_max_age_days')));
    }

    public function isCleared(): bool
    {
        return $this->status->isCleared() && ! $this->isExpired();
    }
}
