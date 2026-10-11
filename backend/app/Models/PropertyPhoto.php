<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

#[Fillable(['property_id', 'path', 'position', 'is_cover'])]
class PropertyPhoto extends Model
{
    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return ['is_cover' => 'boolean'];
    }

    /**
     * @return BelongsTo<Property, $this>
     */
    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    public function url(): string
    {
        // Les données de démonstration pointent vers les photos en ligne de l'ancien site.
        if (str_starts_with($this->path, 'https://')) {
            return $this->path;
        }

        return Storage::disk('public')->url($this->path);
    }
}
