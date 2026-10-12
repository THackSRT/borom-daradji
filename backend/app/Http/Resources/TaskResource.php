<?php

namespace App\Http\Resources;

use App\Models\Task;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Task
 */
class TaskResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'details' => $this->details,
            'due_at' => $this->due_at->toIso8601String(),
            'is_overdue' => $this->done_at === null && $this->due_at->isPast(),
            'priority' => $this->priority->toOption(),
            'done_at' => $this->done_at?->toIso8601String(),
            'user' => $this->user ? ['id' => $this->user->id, 'name' => $this->user->name] : null,
            'client' => $this->client ? [
                'id' => $this->client->id,
                'name' => $this->client->name,
                'phone' => $this->client->phone,
                'whatsapp_url' => $this->client->whatsappUrl(),
            ] : null,
            'property' => $this->property ? ['id' => $this->property->id, 'reference' => $this->property->reference] : null,
        ];
    }
}
