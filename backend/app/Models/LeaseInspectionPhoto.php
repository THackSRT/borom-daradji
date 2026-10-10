<?php

namespace App\Models;

use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Photo d'un état des lieux, rattachée ou non à un élément. Intérieur d'un logement habité : disque
 * privé, consultée par une route contrôlée (loi 2008-12).
 */
#[Fillable(['lease_inspection_item_id', 'path', 'created_by'])]
class LeaseInspectionPhoto extends Model
{
    use LogsActivity;

    /**
     * @return BelongsTo<LeaseInspection, $this>
     */
    public function inspection(): BelongsTo
    {
        return $this->belongsTo(LeaseInspection::class, 'lease_inspection_id');
    }

    /**
     * @return BelongsTo<LeaseInspectionItem, $this>
     */
    public function item(): BelongsTo
    {
        return $this->belongsTo(LeaseInspectionItem::class, 'lease_inspection_item_id');
    }
}
