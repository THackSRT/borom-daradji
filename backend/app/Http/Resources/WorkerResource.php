<?php

namespace App\Http\Resources;

use App\Models\Worker;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Worker
 */
class WorkerResource extends JsonResource
{
    public const PAY_TYPES = ['journalier' => 'À la journée', 'tache' => 'À la tâche'];

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $money = $request->user()?->hasPermission('works.team', 'works.payments', 'works.costs') ?? false;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'phone' => $this->phone,
            'trade' => $this->trade ? ['id' => $this->trade->id, 'name' => $this->trade->name] : null,
            'pay_type' => ['value' => $this->pay_type, 'label' => self::PAY_TYPES[$this->pay_type] ?? $this->pay_type],
            'daily_rate' => $this->daily_rate,
            'is_active' => $this->is_active,
            'notes' => $this->notes,
            'earned' => $this->when($money, fn () => $this->earned()),
            'paid' => $this->when($money, fn () => $this->paid()),
            'balance' => $this->when($money, fn () => $this->balance()),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
