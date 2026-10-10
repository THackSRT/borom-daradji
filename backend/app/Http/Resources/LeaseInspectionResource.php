<?php

namespace App\Http\Resources;

use App\Models\LeaseInspection;
use App\Models\LeaseInspectionItem;
use App\Models\LeaseInspectionPhoto;
use App\Services\InspectionService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin LeaseInspection
 */
class LeaseInspectionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $comparison = $this->relationLoaded('items') ? app(InspectionService::class)->comparison($this->resource) : [];
        $photos = $this->relationLoaded('photos') ? $this->photos : collect();

        return [
            'id' => $this->id,
            'type' => $this->type->toOption(),
            'inspected_on' => $this->inspected_on->toDateString(),
            'inspector' => $this->whenLoaded('inspector', fn () => $this->inspector ? ['id' => $this->inspector->id, 'name' => $this->inspector->name] : null),
            'tenant_present' => $this->tenant_present,
            'electricity_meter' => $this->electricity_meter,
            'water_meter' => $this->water_meter,
            'keys_count' => $this->keys_count,
            'general_comment' => $this->general_comment,
            'validated_at' => $this->validated_at?->toIso8601String(),
            'validator' => $this->whenLoaded('validator', fn () => $this->validator ? ['id' => $this->validator->id, 'name' => $this->validator->name] : null),
            'lease' => $this->whenLoaded('lease', fn () => [
                'id' => $this->lease->id,
                'reference' => $this->lease->reference,
                'status' => $this->lease->status->toOption(),
                'property' => ['id' => $this->lease->property->id, 'reference' => $this->lease->property->reference, 'title' => $this->lease->property->title],
                'tenant' => ['id' => $this->lease->tenant->id, 'name' => $this->lease->tenant->name],
            ]),
            'items' => $this->whenLoaded('items', fn () => $this->items->map(fn (LeaseInspectionItem $item) => [
                'id' => $item->id,
                'room' => $item->room,
                'element' => $item->element,
                'condition' => $item->condition?->toOption(),
                'comment' => $item->comment,
                'entry_condition' => ($comparison[$item->id]['entry_condition'] ?? null)?->toOption(),
                'entry_comment' => $comparison[$item->id]['entry_comment'] ?? null,
                'degraded' => $comparison[$item->id]['degraded'] ?? false,
            ])),
            'photos' => $this->whenLoaded('photos', fn () => $photos->map(fn (LeaseInspectionPhoto $photo) => [
                'id' => $photo->id,
                'item_id' => $photo->lease_inspection_item_id,
                'url' => "/inspections/{$this->id}/photos/{$photo->id}",
            ])),
            'items_count' => $this->whenCounted('items'),
            'rated_count' => $this->when(isset($this->rated_count), fn () => (int) $this->rated_count),
            'photos_count' => $this->whenCounted('photos'),
            'can' => $request->user() ? [
                'update' => ! $this->isValidated() && $request->user()->can('update', $this->lease),
            ] : null,
        ];
    }
}
