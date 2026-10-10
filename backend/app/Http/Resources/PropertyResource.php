<?php

namespace App\Http\Resources;

use App\Models\Property;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Fiche complète d'un bien, pour le back-office.
 *
 * @mixin Property
 */
class PropertyResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $user = $request->user();

        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'slug' => $this->slug,
            'title' => $this->title,
            'type' => $this->type->toOption(),
            'transaction' => $this->transaction->toOption(),
            'status' => $this->status->toOption(),
            'price' => $this->price,
            'charges' => $this->charges,
            'deposit_months' => $this->deposit_months,
            'advance_months' => $this->advance_months,
            'surface' => $this->surface,
            'land_surface' => $this->land_surface,
            'rooms' => $this->rooms,
            'bedrooms' => $this->bedrooms,
            'bathrooms' => $this->bathrooms,
            'features' => $this->features,
            'city' => $this->city,
            'neighborhood' => $this->neighborhood,
            'address' => $this->address,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'description' => $this->description,
            'land_status' => $this->land_status->toOption(),
            'land_reference' => $this->land_reference,
            'is_featured' => $this->is_featured,
            'published_at' => $this->published_at?->toIso8601String(),
            'cover_url' => $this->whenLoaded('cover', fn () => $this->cover?->url()),
            'owner' => $this->whenLoaded('owner', fn () => $this->owner ? [
                'id' => $this->owner->id,
                'name' => $this->owner->name,
                'phone' => $this->owner->phone,
            ] : null),
            'agent' => $this->whenLoaded('agent', fn () => $this->agent ? ['id' => $this->agent->id, 'name' => $this->agent->name] : null),
            'photos' => PropertyPhotoResource::collection($this->whenLoaded('photos')),
            'checks' => PropertyCheckResource::collection($this->whenLoaded('checks')),
            'status_changes' => $this->whenLoaded('statusChanges', fn () => $this->statusChanges->map(fn ($change) => [
                'from' => $change->from?->toOption(),
                'to' => $change->to->toOption(),
                'reason' => $change->reason,
                'user' => $change->user?->name,
                'at' => $change->created_at?->toIso8601String(),
            ])),
            'can' => [
                'update' => $user?->can('update', $this->resource) ?? false,
                'view_documents' => $user?->can('viewDocuments', $this->resource) ?? false,
            ],
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
