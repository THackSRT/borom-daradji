<?php

namespace App\Http\Resources;

use App\Models\Worksite;
use App\Models\WorksiteLog;
use App\Models\WorksiteLot;
use App\Models\WorksitePhoto;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Worksite
 */
class WorksiteResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $user = $request->user();
        $costs = $user?->can('viewCosts', $this->resource) ?? false;

        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'title' => $this->title,
            'status' => $this->status->toOption(),
            'allowed_transitions' => array_map(fn ($s) => $s->toOption(), $this->status->allowedTransitions()),
            'address' => $this->address,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'client' => $this->whenLoaded('client', fn () => ['id' => $this->client->id, 'name' => $this->client->name, 'phone' => $this->client->phone]),
            'property' => $this->whenLoaded('property', fn () => $this->property ? ['id' => $this->property->id, 'reference' => $this->property->reference, 'title' => $this->property->title] : null),
            'quote' => $this->whenLoaded('quote', fn () => $this->quote ? ['id' => $this->quote->id, 'number' => $this->quote->number] : null),
            'manager' => $this->whenLoaded('manager', fn () => $this->manager ? ['id' => $this->manager->id, 'name' => $this->manager->name] : null),
            'start_date' => $this->start_date?->toDateString(),
            'planned_end_date' => $this->planned_end_date?->toDateString(),
            'actual_end_date' => $this->actual_end_date?->toDateString(),
            'is_late' => $this->status->isOpen() && $this->planned_end_date?->isPast() === true,
            'progress' => $this->when($this->relationLoaded('lots'), fn () => $this->progress()),
            'contract_ht' => $this->contract_ht,
            'contract_total' => $this->contract_total,
            'budget' => $this->when($costs, fn () => [
                'materials' => $this->budget_materials,
                'labor' => $this->budget_labor,
                'other' => $this->budget_other,
                'total' => $this->budgetTotal(),
            ]),
            'notes' => $this->notes,
            'lots' => $this->whenLoaded('lots', fn () => $this->lots->map(fn (WorksiteLot $lot) => [
                'id' => $lot->id,
                'title' => $lot->title,
                'trade_id' => $lot->trade_id,
                'amount_ht' => $lot->amount_ht,
                'progress' => $lot->progress,
            ])),
            'logs' => $this->whenLoaded('logs', fn () => $this->logs->map(fn (WorksiteLog $log) => [
                'id' => $log->id,
                'kind' => $log->kind,
                'logged_on' => $log->logged_on->toDateString(),
                'body' => $log->body,
                'is_public' => $log->is_public,
                'user' => $log->user ? ['id' => $log->user->id, 'name' => $log->user->name] : null,
                'created_at' => $log->created_at?->toIso8601String(),
            ])),
            'photos' => $this->whenLoaded('photos', fn () => $this->photos->map(fn (WorksitePhoto $p) => [
                'id' => $p->id,
                'lot_id' => $p->worksite_lot_id,
                'caption' => $p->caption,
                'taken_at' => $p->taken_at->toIso8601String(),
                'latitude' => $p->latitude,
                'longitude' => $p->longitude,
                'is_public' => $p->is_public,
                'url' => "/worksites/{$this->id}/photos/{$p->id}",
            ])),
            // Jeton du lien de suivi : l'écran construit l'adresse (/suivi/{jeton}) sur son propre domaine.
            'tracking_token' => $this->when($user?->can('update', $this->resource) ?? false, fn () => $this->tracking_token),
            'can' => $user ? [
                'update' => $user->can('update', $this->resource),
                'costs' => $costs,
            ] : null,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
