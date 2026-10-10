<?php

namespace App\Http\Resources;

use App\Enums\ClientCategory;
use App\Models\Client;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Client
 */
class ClientResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $user = $request->user();

        return [
            'id' => $this->id,
            'kind' => $this->kind->toOption(),
            'name' => $this->name,
            'phone' => $this->phone,
            'whatsapp' => $this->whatsapp,
            'whatsapp_url' => $this->whatsappUrl(),
            'email' => $this->email,
            'categories' => $this->categories->map(fn (ClientCategory $c) => $c->toOption())->values(),
            'city' => $this->city,
            'address' => $this->address,
            'source' => $this->source?->toOption(),
            'pipeline_status' => $this->pipeline_status->toOption(),
            'solvency' => $this->solvency,
            'tags' => $this->tags,
            'assigned_user' => $this->whenLoaded('assignedUser', fn () => $this->assignedUser
                ? ['id' => $this->assignedUser->id, 'name' => $this->assignedUser->name]
                : null),
            'last_contact_at' => $this->last_contact_at?->toIso8601String(),
            // Notes privées : visibles du dirigeant et de l'agent assigné seulement.
            'private_notes' => $this->when(
                $user && ($user->isDirigeant() || $this->assigned_user_id === $user->id),
                $this->private_notes,
            ),
            'search_criteria' => SearchCriterionResource::collection($this->whenLoaded('searchCriteria')),
            'interactions' => InteractionResource::collection($this->whenLoaded('interactions')),
            'visits' => VisitResource::collection($this->whenLoaded('visits')),
            'can' => [
                'view_documents' => $user?->can('viewDocuments', $this->resource) ?? false,
                'delete' => $user?->can('delete', $this->resource) ?? false,
            ],
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
