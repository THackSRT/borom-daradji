<?php

namespace App\Http\Resources;

use App\Models\Article;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Article : prix d'achat, coût moyen et valeur du stock seulement avec « stock.costs ».
 *
 * @mixin Article
 */
class ArticleResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $costs = $request->user()?->hasPermission('stock.costs') ?? false;

        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'name' => $this->name,
            'category' => $this->category ? ['id' => $this->category->id, 'name' => $this->category->name] : null,
            'unit' => $this->unit,
            'sale_price' => $this->sale_price,
            'vat_rate' => $this->vat_rate,
            'quantity' => $this->quantity,
            'min_quantity' => $this->min_quantity,
            'max_quantity' => $this->max_quantity,
            'is_low' => $this->isLow(),
            'location' => $this->location,
            'supplier' => $this->supplier ? ['id' => $this->supplier->id, 'name' => $this->supplier->name, 'phone' => $this->supplier->phone] : null,
            'is_active' => $this->is_active,
            'notes' => $this->notes,
            'purchase_price' => $this->when($costs, $this->purchase_price),
            'average_cost' => $this->when($costs, fn () => round($this->average_cost, 2)),
            'stock_value' => $this->when($costs, fn () => $this->stockValue()),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
