<?php

namespace App\Http\Requests;

use App\Rules\SenegalPhone;
use App\Support\PhoneNumber;
use Illuminate\Foundation\Http\FormRequest;

class UpdateCompanySettingsRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        foreach (['phone', 'whatsapp'] as $field) {
            if ($this->filled($field)) {
                $this->merge([$field => PhoneNumber::normalize($this->input($field)) ?? $this->input($field)]);
            }
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'trade_name' => ['sometimes', 'required', 'string', 'max:255'],
            'legal_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'ninea' => ['sometimes', 'nullable', 'string', 'max:30'],
            'rccm' => ['sometimes', 'nullable', 'string', 'max:50'],
            'address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'city' => ['sometimes', 'nullable', 'string', 'max:100'],
            'phone' => ['sometimes', 'nullable', new SenegalPhone],
            'whatsapp' => ['sometimes', 'nullable', new SenegalPhone],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'website' => ['sometimes', 'nullable', 'url', 'max:255'],
            'bank_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'bank_account' => ['sometimes', 'nullable', 'string', 'max:255'],
            'vat_rate' => ['sometimes', 'required', 'numeric', 'min:0', 'max:100'],
            'invoice_footer' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ];
    }
}
