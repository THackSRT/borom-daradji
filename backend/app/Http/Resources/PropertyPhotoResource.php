<?php

namespace App\Http\Resources;

use App\Models\PropertyPhoto;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin PropertyPhoto
 */
class PropertyPhotoResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'url' => $this->url(),
            'position' => $this->position,
            'is_cover' => $this->is_cover,
        ];
    }
}
