<?php

namespace App\Http\Requests;

use App\Enums\CheckStatus;
use App\Models\PropertyCheck;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PropertyCheckRequest extends FormRequest
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
        /** @var PropertyCheck $check */
        $check = $this->route('check');

        return [
            'status' => ['required', Rule::enum(CheckStatus::class)],
            // « Sans objet » et « problème » doivent être expliqués.
            'note' => [
                Rule::requiredIf(in_array($this->input('status'), [CheckStatus::SansObjet->value, CheckStatus::Ko->value], true)),
                'nullable', 'string', 'max:2000',
            ],
            'document_id' => [
                'nullable', 'integer',
                Rule::exists('property_documents', 'id')->where('property_id', $check->property_id),
            ],
        ];
    }
}
