<?php

namespace App\Http\Requests;

use App\Rules\SenegalPhone;
use App\Support\PhoneNumber;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Demande envoyée depuis le site vitrine (public).
 */
class LeadRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->filled('phone')) {
            $this->merge(['phone' => PhoneNumber::normalize($this->input('phone')) ?? $this->input('phone')]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'phone' => ['required', new SenegalPhone],
            'email' => ['nullable', 'email', 'max:255'],
            'message' => ['required', 'string', 'max:2000'],
            'property' => ['nullable', 'string', 'max:255'],
            // Champ piège invisible pour les humains : rempli = robot (ignoré sans le dire, voir LeadController).
            'website' => ['nullable', 'string', 'max:255'],
        ];
    }
}
