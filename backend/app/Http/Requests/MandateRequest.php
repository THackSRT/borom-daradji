<?php

namespace App\Http\Requests;

use App\Enums\CommissionType;
use App\Enums\MandateStatus;
use App\Enums\MandateType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class MandateRequest extends FormRequest
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
        $required = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'owner_id' => ['nullable', 'integer', Rule::exists('clients', 'id')->whereNull('deleted_at')],
            'type' => [$required, Rule::enum(MandateType::class)],
            'starts_on' => [$required, 'date'],
            'ends_on' => [$required, 'date', 'after:starts_on'],
            'commission_type' => [$required, Rule::enum(CommissionType::class)],
            'commission_value' => array_filter([
                $required, 'numeric', 'min:0',
                $this->input('commission_type') === CommissionType::Pourcentage->value ? 'max:100' : null,
            ]),
            'status' => ['sometimes', Rule::enum(MandateStatus::class)],
            'conditions' => ['nullable', 'string', 'max:5000'],
        ];
    }
}
