<?php

namespace App\Http\Resources;

use App\Models\DepositSettlement;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin DepositSettlement
 */
class DepositSettlementResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'number' => $this->number,
            'deposit_held' => $this->deposit_held,
            'arrears_retained' => $this->arrears_retained,
            'deductions' => $this->deductions,
            'deductions_total' => $this->deductions_total,
            'refund' => $this->refund,
            'balance_due' => $this->balance_due,
            'balance_invoice' => $this->whenLoaded('balanceInvoice', fn () => $this->balanceInvoice ? [
                'id' => $this->balanceInvoice->id,
                'number' => $this->balanceInvoice->number,
                'status' => $this->balanceInvoice->status->toOption(),
            ] : null),
            'refund_method' => $this->refund_method?->toOption(),
            'refund_reference' => $this->refund_reference,
            'settled_on' => $this->settled_on->toDateString(),
            'exit_inspection_id' => $this->exit_inspection_id,
            'note' => $this->note,
            'creator' => $this->whenLoaded('creator', fn () => ['id' => $this->creator->id, 'name' => $this->creator->name]),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
