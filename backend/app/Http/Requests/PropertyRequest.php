<?php

namespace App\Http\Requests;

use App\Enums\LandStatus;
use App\Enums\PropertyType;
use App\Enums\TransactionType;
use App\Models\Property;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Création (POST) et modification (PUT/PATCH) d'un bien. Le statut se change par une route dédiée.
 */
class PropertyRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->isMethod('post')
            ? $this->user()->can('create', Property::class)
            : $this->user()->can('update', $this->route('property'));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $required = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'title' => [$required, 'string', 'max:255'],
            'type' => [$required, Rule::enum(PropertyType::class)],
            'transaction' => [$required, Rule::enum(TransactionType::class)],
            'price' => [$required, 'integer', 'min:0'],
            'charges' => ['nullable', 'integer', 'min:0'],
            'deposit_months' => ['nullable', 'integer', 'min:0', 'max:24'],
            'advance_months' => ['nullable', 'integer', 'min:0', 'max:24'],
            'surface' => ['nullable', 'integer', 'min:1'],
            'land_surface' => ['nullable', 'integer', 'min:1'],
            'rooms' => ['nullable', 'integer', 'min:0', 'max:255'],
            'bedrooms' => ['nullable', 'integer', 'min:0', 'max:255'],
            'bathrooms' => ['nullable', 'integer', 'min:0', 'max:255'],
            'features' => ['sometimes', 'array', 'max:40'],
            'features.*' => ['string', 'max:60'],
            'city' => [$required, 'string', 'max:100'],
            'neighborhood' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:255'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'description' => ['nullable', 'string', 'max:10000'],
            'land_status' => ['sometimes', Rule::enum(LandStatus::class)],
            'land_reference' => ['nullable', 'string', 'max:100'],
            'owner_id' => ['nullable', 'integer', Rule::exists('clients', 'id')->whereNull('deleted_at')],
            'agent_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('is_active', true)],
            'is_featured' => ['sometimes', 'boolean'],
        ];
    }
}
