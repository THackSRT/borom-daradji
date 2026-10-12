<?php

namespace App\Http\Resources;

use App\Models\SiteCashEntry;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin SiteCashEntry
 */
class SiteCashEntryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'kind' => ['value' => $this->kind, 'label' => SiteCashEntry::KINDS[$this->kind][0]],
            'category' => $this->category ? ['value' => $this->category, 'label' => SiteCashEntry::CATEGORIES[$this->category] ?? $this->category] : null,
            'amount' => $this->amount,
            'signed_amount' => $this->sign() * $this->amount,
            'label' => $this->label,
            'spent_on' => $this->spent_on->toDateString(),
            'receipt_url' => $this->receipt_path ? "/worksites/{$this->worksite_id}/cash/{$this->id}/receipt" : null,
            'from_cash_register' => $this->cash_movement_id !== null,
            'client_uuid' => $this->client_uuid,
            'author' => $this->whenLoaded('author', fn () => $this->author ? ['id' => $this->author->id, 'name' => $this->author->name] : null),
            'cancelled_at' => $this->cancelled_at?->toIso8601String(),
            'cancel_reason' => $this->cancel_reason,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
