<?php

namespace App\Http\Resources;

use App\Models\PropertyCheck;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin PropertyCheck
 */
class PropertyCheckResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'item' => $this->item->toOption(),
            'status' => $this->status->toOption(),
            'is_cleared' => $this->isCleared(),
            'is_expired' => $this->isExpired(),
            'note' => $this->note,
            'document_id' => $this->document_id,
            'checked_by' => $this->checker?->name,
            'checked_at' => $this->checked_at?->toIso8601String(),
        ];
    }
}
