<?php

namespace App\Http\Resources;

use App\Enums\PaymentMethod;
use App\Models\CashMovement;
use App\Models\CashSession;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin CashSession
 */
class CashSessionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $closed = $this->isClosed();

        return [
            'id' => $this->id,
            'user' => $this->whenLoaded('user', fn () => ['id' => $this->user->id, 'name' => $this->user->name]),
            'date' => $this->date->toDateString(),
            'is_today' => $this->date->isToday(),
            'opening_amount' => $this->opening_amount,
            'cash_in' => $this->cashIn(),
            'movements_total' => $this->movementsTotal(),
            'expected_amount' => $closed ? $this->expected_amount : $this->expected(),
            'counted_amount' => $this->counted_amount,
            'difference' => $this->difference,
            'closing_note' => $this->closing_note,
            'closed_at' => $this->closed_at?->toIso8601String(),
            // Encaissements hors espèces de la même personne le même jour : à rapprocher des relevés Wave / Orange Money.
            'other_methods' => $this->when($this->relationLoaded('payments'), fn () => Payment::query()->valid()
                ->where('received_by', $this->user_id)
                ->whereDate('created_at', $this->date)
                ->where('method', '!=', PaymentMethod::Especes)
                ->selectRaw('method, sum(amount) as total, count(*) as count')->groupBy('method')->get()
                ->map(fn ($row) => [
                    'method' => $row->method->toOption(),
                    'total' => (int) $row->total,
                    'count' => (int) $row->count,
                ])->values()),
            'payments' => PaymentResource::collection($this->whenLoaded('payments')),
            'movements' => $this->whenLoaded('movements', fn () => $this->movements->map(fn (CashMovement $m) => [
                'id' => $m->id,
                'type' => $m->type->toOption(),
                'amount' => $m->type->sign() * $m->amount,
                'label' => $m->label,
                'created_at' => $m->created_at?->toIso8601String(),
            ])),
        ];
    }
}
