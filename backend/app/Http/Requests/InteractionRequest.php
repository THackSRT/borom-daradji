<?php

namespace App\Http\Requests;

use App\Enums\InteractionChannel;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class InteractionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('client'));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            // Le formulaire du site n'est enregistré que par l'API publique.
            'channel' => ['required', Rule::enum(InteractionChannel::class)->except([InteractionChannel::FormulaireSite])],
            'summary' => ['required', 'string', 'max:5000'],
            'occurred_at' => ['nullable', 'date', 'before_or_equal:now'],
            'property_id' => ['nullable', 'integer', Rule::exists('properties', 'id')],
        ];
    }
}
