<?php

namespace App\Http\Requests;

use App\Enums\PropertyType;
use App\Enums\TransactionType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SearchCriterionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('manageProspection', $this->route('client'));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $required = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'transaction' => [$required, Rule::enum(TransactionType::class)],
            'types' => ['sometimes', 'array'],
            'types.*' => ['distinct', Rule::enum(PropertyType::class)],
            'budget_min' => ['nullable', 'integer', 'min:0'],
            'budget_max' => array_filter(['nullable', 'integer', 'min:0', $this->filled('budget_min') ? 'gte:budget_min' : null]),
            'cities' => ['sometimes', 'array', 'max:10'],
            'cities.*' => ['string', 'max:100'],
            'neighborhoods' => ['sometimes', 'array', 'max:20'],
            'neighborhoods.*' => ['string', 'max:100'],
            'rooms_min' => ['nullable', 'integer', 'min:0', 'max:50'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
