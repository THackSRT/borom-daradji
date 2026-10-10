<?php

namespace App\Http\Requests;

use App\Enums\VisitFeedback;
use App\Enums\VisitStatus;
use App\Models\Visit;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Planification (POST) et compte-rendu ou report (PUT/PATCH) d'une visite.
 */
class VisitRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->isMethod('post')
            ? $this->user()->can('create', Visit::class)
            : $this->user()->can('update', $this->route('visit'));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $creating = $this->isMethod('post');

        return [
            'property_id' => [$creating ? 'required' : 'prohibited', 'integer', Rule::exists('properties', 'id')->whereNull('deleted_at')],
            'client_id' => [$creating ? 'required' : 'prohibited', 'integer', Rule::exists('clients', 'id')->whereNull('deleted_at')],
            'agent_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('is_active', true)],
            'scheduled_at' => [$creating ? 'required' : 'sometimes', 'date'],
            'status' => [$creating ? 'prohibited' : 'sometimes', Rule::enum(VisitStatus::class)],
            'feedback' => [
                Rule::requiredIf($this->input('status') === VisitStatus::Effectuee->value),
                'nullable', Rule::enum(VisitFeedback::class),
            ],
            'notes' => ['nullable', 'string', 'max:5000'],
            'next_action' => ['nullable', 'string', 'max:255'],
        ];
    }
}
