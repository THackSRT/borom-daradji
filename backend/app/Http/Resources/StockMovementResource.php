<?php

namespace App\Http\Resources;

use App\Models\StockMovement;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin StockMovement
 */
class StockMovementResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $costs = $request->user()?->hasPermission('stock.costs') ?? false;

        return [
            'id' => $this->id,
            'type' => $this->type->toOption(),
            'quantity' => $this->quantity,
            'quantity_after' => $this->quantity_after,
            'moved_on' => $this->moved_on->toDateString(),
            'reason' => $this->reason,
            'article' => $this->whenLoaded('article', fn () => ['id' => $this->article->id, 'reference' => $this->article->reference, 'name' => $this->article->name, 'unit' => $this->article->unit]),
            'worksite' => $this->whenLoaded('worksite', fn () => $this->worksite ? ['id' => $this->worksite->id, 'reference' => $this->worksite->reference, 'title' => $this->worksite->title] : null),
            'purchase' => $this->whenLoaded('purchase', fn () => $this->purchase ? ['id' => $this->purchase->id, 'number' => $this->purchase->number] : null),
            'invoice' => $this->whenLoaded('invoice', fn () => $this->invoice ? ['id' => $this->invoice->id, 'number' => $this->invoice->number] : null),
            'author' => $this->whenLoaded('author', fn () => $this->author ? ['id' => $this->author->id, 'name' => $this->author->name] : null),
            'unit_cost' => $this->when($costs, fn () => round($this->unit_cost, 2)),
            'value' => $this->when($costs, $this->value),
            'average_cost_after' => $this->when($costs, fn () => round($this->average_cost_after, 2)),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
