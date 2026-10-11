<?php

namespace App\Http\Resources;

use App\Models\Mandate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Mandate
 */
class MandateResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'property_id' => $this->property_id,
            'owner' => $this->owner ? ['id' => $this->owner->id, 'name' => $this->owner->name] : null,
            'type' => $this->type->toOption(),
            'starts_on' => $this->starts_on->toDateString(),
            'ends_on' => $this->ends_on->toDateString(),
            'commission_type' => $this->commission_type->toOption(),
            'commission_value' => (float) $this->commission_value,
            'status' => $this->status->toOption(),
            'conditions' => $this->conditions,
        ];
    }
}
