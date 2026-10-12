<?php

namespace App\Models;

use App\Enums\CommissionType;
use App\Enums\MandateStatus;
use App\Enums\MandateType;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['owner_id', 'type', 'starts_on', 'ends_on', 'commission_type', 'commission_value', 'status', 'conditions'])]
class Mandate extends Model
{
    use LogsActivity;

    protected $attributes = [
        'status' => 'actif',
    ];

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'type' => MandateType::class,
            'commission_type' => CommissionType::class,
            'status' => MandateStatus::class,
            'commission_value' => 'decimal:2',
            'starts_on' => 'date',
            'ends_on' => 'date',
            'expiry_alerted_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Property, $this>
     */
    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    /**
     * @return BelongsTo<Client, $this>
     */
    public function owner(): BelongsTo
    {
        return $this->belongsTo(Client::class, 'owner_id');
    }
}
