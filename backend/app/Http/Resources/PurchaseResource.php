<?php

namespace App\Http\Resources;

use App\Models\Purchase;
use App\Models\PurchaseLine;
use App\Models\SupplierPayment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Purchase
 */
class PurchaseResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'number' => $this->number,
            'supplier' => $this->whenLoaded('supplier', fn () => ['id' => $this->supplier->id, 'name' => $this->supplier->name, 'phone' => $this->supplier->phone]),
            'supplier_reference' => $this->supplier_reference,
            'received_on' => $this->received_on->toDateString(),
            'due_date' => $this->due_date?->toDateString(),
            'subtotal' => $this->subtotal,
            'vat_total' => $this->vat_total,
            'total' => $this->total,
            'paid_total' => $this->paid_total,
            'balance' => $this->balance(),
            'is_overdue' => ! $this->isCancelled() && $this->balance() > 0 && $this->due_date?->isPast() === true,
            'notes' => $this->notes,
            'lines' => $this->whenLoaded('lines', fn () => $this->lines->map(fn (PurchaseLine $l) => [
                'id' => $l->id,
                'article' => ['id' => $l->article->id, 'reference' => $l->article->reference, 'name' => $l->article->name, 'unit' => $l->article->unit],
                'quantity' => $l->quantity,
                'unit_cost' => $l->unit_cost,
                'vat_rate' => $l->vat_rate,
                'amount' => $l->amount,
                'vat_amount' => $l->vat_amount,
            ])),
            'payments' => $this->whenLoaded('payments', fn () => $this->payments->map(fn (SupplierPayment $p) => [
                'id' => $p->id,
                'amount' => $p->amount,
                'paid_on' => $p->paid_on->toDateString(),
                'method' => $p->method->toOption(),
                'reference' => $p->reference,
                'note' => $p->note,
                'paid_by' => $p->payer ? ['id' => $p->payer->id, 'name' => $p->payer->name] : null,
                'cancelled_at' => $p->cancelled_at?->toIso8601String(),
                'cancel_reason' => $p->cancel_reason,
            ])),
            'author' => $this->whenLoaded('author', fn () => $this->author ? ['id' => $this->author->id, 'name' => $this->author->name] : null),
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            'cancel_reason' => $this->cancel_reason,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
