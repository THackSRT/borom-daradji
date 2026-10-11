<?php

namespace App\Http\Resources;

use App\Models\WorkerPayment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin WorkerPayment
 */
class WorkerPaymentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'kind' => ['value' => $this->kind, 'label' => $this->kind === 'avance' ? 'Avance' : 'Paiement'],
            'amount' => $this->amount,
            'paid_on' => $this->paid_on->toDateString(),
            'method' => $this->method->toOption(),
            'reference' => $this->reference,
            'note' => $this->note,
            'from_site_cash' => $this->site_cash_entry_id !== null,
            'worker' => $this->whenLoaded('worker', fn () => ['id' => $this->worker->id, 'name' => $this->worker->name]),
            'worksite' => $this->whenLoaded('worksite', fn () => $this->worksite ? ['id' => $this->worksite->id, 'reference' => $this->worksite->reference, 'title' => $this->worksite->title] : null),
            'paid_by' => $this->whenLoaded('payer', fn () => $this->payer ? ['id' => $this->payer->id, 'name' => $this->payer->name] : null),
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            'cancel_reason' => $this->cancel_reason,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
