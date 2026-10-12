<?php

namespace App\Http\Requests;

use App\Enums\PropertyStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ChangePropertyStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('property'));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'status' => ['required', Rule::enum(PropertyStatus::class)],
            // Motif obligatoire pour retirer un bien ou le remettre en vente.
            'reason' => [
                Rule::requiredIf(in_array($this->input('status'), [PropertyStatus::Retire->value], true)),
                'nullable', 'string', 'max:255',
            ],
        ];
    }
}
