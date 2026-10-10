<?php

namespace App\Models;

use App\Enums\PropertyDocumentType;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Pièce d'un bien (titre foncier, état des droits réels, mandat…), stockée sur le disque privé.
 */
#[Fillable(['property_id', 'type', 'path', 'original_name', 'uploaded_by'])]
class PropertyDocument extends Model
{
    use LogsActivity;

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return ['type' => PropertyDocumentType::class];
    }

    /**
     * @return BelongsTo<Property, $this>
     */
    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }
}
