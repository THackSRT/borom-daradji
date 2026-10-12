<?php

namespace App\Http\Resources;

use App\Enums\PropertyType;
use App\Models\SearchCriterion;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin SearchCriterion
 */
class SearchCriterionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'transaction' => $this->transaction->toOption(),
            'types' => $this->types->map(fn (PropertyType $t) => $t->toOption())->values(),
            'budget_min' => $this->budget_min,
            'budget_max' => $this->budget_max,
            'cities' => $this->cities,
            'neighborhoods' => $this->neighborhoods,
            'rooms_min' => $this->rooms_min,
            'is_active' => $this->is_active,
        ];
    }
}
