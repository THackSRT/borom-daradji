<?php

namespace App\Http\Requests;

use App\Enums\PaymentMethod;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('recordPayment', $this->route('invoice'));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $method = PaymentMethod::tryFrom((string) $this->input('method'));

        return [
            'method' => ['required', Rule::enum(PaymentMethod::class)->except([PaymentMethod::Caution])],
            'amount' => ['required', 'integer', 'min:1'],
            'paid_on' => ['nullable', 'date', 'before_or_equal:today'],
            'reference' => [$method?->requiresReference() ? 'required' : 'nullable', 'string', 'max:100'],
            'proof' => ['nullable', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:5120'],
            'note' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'reference.required' => 'Indiquez la référence de la transaction (numéro Wave / Orange Money, numéro de chèque ou de virement).',
            'paid_on.before_or_equal' => 'La date d\'encaissement ne peut pas être dans le futur.',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['method' => 'mode de paiement', 'amount' => 'montant', 'proof' => 'justificatif'];
    }
}
