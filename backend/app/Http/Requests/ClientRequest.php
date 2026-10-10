<?php

namespace App\Http\Requests;

use App\Enums\ClientCategory;
use App\Enums\ClientKind;
use App\Enums\LeadSource;
use App\Enums\PipelineStatus;
use App\Models\Client;
use App\Rules\SenegalPhone;
use App\Support\PhoneNumber;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Création (POST) et modification (PUT/PATCH) d'un client. L'unicité du téléphone à la création
 * est gérée par le contrôleur, qui renvoie la fiche existante au lieu d'une simple erreur.
 */
class ClientRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->isMethod('post')
            ? $this->user()->can('create', Client::class)
            : $this->user()->can('update', $this->route('client'));
    }

    protected function prepareForValidation(): void
    {
        foreach (['phone', 'whatsapp'] as $field) {
            if ($this->filled($field)) {
                $this->merge([$field => PhoneNumber::normalize($this->input($field)) ?? $this->input($field)]);
            }
        }

        if ($this->filled('email')) {
            $this->merge(['email' => Str::lower(trim((string) $this->input('email')))]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $required = $this->isMethod('post') ? 'required' : 'sometimes';
        $client = $this->route('client');

        return [
            'kind' => ['sometimes', Rule::enum(ClientKind::class)],
            'name' => [$required, 'string', 'max:255'],
            'phone' => array_filter([
                'nullable', new SenegalPhone,
                $this->isMethod('post') ? null : Rule::unique('clients', 'phone')->ignore($client),
            ]),
            'whatsapp' => ['nullable', new SenegalPhone],
            'email' => ['nullable', 'email', 'max:255'],
            'categories' => ['sometimes', 'array'],
            'categories.*' => ['distinct', Rule::enum(ClientCategory::class)],
            'city' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:255'],
            'source' => ['nullable', Rule::enum(LeadSource::class)],
            'pipeline_status' => ['sometimes', Rule::enum(PipelineStatus::class)],
            'solvency' => ['nullable', Rule::in(['A', 'B', 'C'])],
            'tags' => ['sometimes', 'array', 'max:20'],
            'tags.*' => ['string', 'max:40'],
            'assigned_user_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('is_active', true)],
            'private_notes' => ['nullable', 'string', 'max:10000'],
        ];
    }
}
