<?php

namespace App\Models;

use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Photo de chantier, datée (prise de vue) et géolocalisée quand le téléphone le permet. Disque
 * privé : servie par une route contrôlée, ou par le lien de suivi si elle est publique.
 */
#[Fillable(['worksite_lot_id', 'path', 'caption', 'taken_at', 'latitude', 'longitude', 'is_public', 'client_uuid', 'created_by'])]
class WorksitePhoto extends Model
{
    use LogsActivity;

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return ['taken_at' => 'datetime', 'latitude' => 'float', 'longitude' => 'float', 'is_public' => 'boolean'];
    }

    /**
     * @return BelongsTo<Worksite, $this>
     */
    public function worksite(): BelongsTo
    {
        return $this->belongsTo(Worksite::class);
    }

    /**
     * @return BelongsTo<WorksiteLot, $this>
     */
    public function lot(): BelongsTo
    {
        return $this->belongsTo(WorksiteLot::class, 'worksite_lot_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
