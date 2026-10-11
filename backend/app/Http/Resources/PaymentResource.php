<?php

namespace App\Http\Resources;

use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Payment
 */
class PaymentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'number' => $this->number,
            'invoice' => $this->whenLoaded('invoice', fn () => ['id' => $this->invoice->id, 'number' => $this->invoice->number]),
            'client' => $this->whenLoaded('client', fn () => ['id' => $this->client->id, 'name' => $this->client->name]),
            'method' => $this->method->toOption(),
            'amount' => $this->amount,
            'paid_on' => $this->paid_on->toDateString(),
            'reference' => $this->reference,
            'has_proof' => $this->proof_path !== null,
            'note' => $this->note,
            'received_by' => $this->whenLoaded('receiver', fn () => ['id' => $this->receiver->id, 'name' => $this->receiver->name]),
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            'cancel_reason' => $this->cancel_reason,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
