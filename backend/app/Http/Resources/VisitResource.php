<?php

namespace App\Http\Resources;

use App\Models\Visit;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Visit
 */
class VisitResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'scheduled_at' => $this->scheduled_at->toIso8601String(),
            'status' => $this->status->toOption(),
            'feedback' => $this->feedback?->toOption(),
            'notes' => $this->notes,
            'next_action' => $this->next_action,
            'property' => $this->property ? [
                'id' => $this->property->id,
                'reference' => $this->property->reference,
                'title' => $this->property->title,
                'neighborhood' => $this->property->neighborhood,
            ] : null,
            'client' => $this->client ? [
                'id' => $this->client->id,
                'name' => $this->client->name,
                'phone' => $this->client->phone,
                'whatsapp_url' => $this->client->whatsappUrl(
                    "Bonjour {$this->client->name}, je vous confirme la visite du {$this->scheduled_at->translatedFormat('d/m/Y à H\hi')}."
                ),
            ] : null,
            'agent' => $this->agent ? ['id' => $this->agent->id, 'name' => $this->agent->name] : null,
        ];
    }
}
