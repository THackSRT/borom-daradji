<?php

namespace App\Http\Resources;

use App\Models\Interaction;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Interaction
 */
class InteractionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'channel' => $this->channel->toOption(),
            'summary' => $this->summary,
            'occurred_at' => $this->occurred_at->toIso8601String(),
            'user' => $this->user ? ['id' => $this->user->id, 'name' => $this->user->name] : null,
            'property' => $this->property ? ['id' => $this->property->id, 'reference' => $this->property->reference] : null,
        ];
    }
}
