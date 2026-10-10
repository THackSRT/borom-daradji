<?php

namespace App\Models;

use App\Enums\PropertyType;
use App\Enums\TransactionType;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\AsEnumCollection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Ce que cherche un prospect. Liste vide (types, villes, quartiers) = indifférent.
 */
#[Fillable(['client_id', 'transaction', 'types', 'budget_min', 'budget_max', 'cities', 'neighborhoods', 'rooms_min', 'is_active'])]
class SearchCriterion extends Model
{
    use LogsActivity;

    protected $table = 'search_criteria';

    protected $attributes = [
        'types' => '[]',
        'cities' => '[]',
        'neighborhoods' => '[]',
        'is_active' => true,
    ];

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'transaction' => TransactionType::class,
            'types' => AsEnumCollection::of(PropertyType::class),
            'cities' => 'array',
            'neighborhoods' => 'array',
            'budget_min' => 'integer',
            'budget_max' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<Client, $this>
     */
    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }
}
