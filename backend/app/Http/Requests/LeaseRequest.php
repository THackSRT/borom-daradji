<?php

namespace App\Http\Requests;

use App\Models\Lease;
use App\Models\Property;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Création d'un bail, ou modification de ce qui peut changer en cours de bail (loyer, échéance,
 * gestion, fin prévue…). Le bien, le locataire et la date d'entrée ne changent pas : nouveau bail.
 */
class LeaseRequest extends FormRequest
{
    public function authorize(): bool
    {
        $lease = $this->route('lease');

        return $lease instanceof Lease ? $this->user()->can('update', $lease) : $this->user()->can('create', Lease::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $creating = ! $this->route('lease');
        $required = $creating ? 'required' : 'sometimes';
        $client = Rule::exists('clients', 'id')->whereNull('deleted_at');

        return [
            ...($creating ? [
                'property_id' => ['required', 'integer', Rule::exists('properties', 'id')->whereNull('deleted_at')],
                'tenant_id' => ['required', 'integer', $client],
                'start_date' => ['required', 'date'],
                'billing_start' => ['nullable', 'date'],
                'deposit' => ['nullable', 'integer', 'min:0'],
                'advance_months' => ['nullable', 'integer', 'min:0', 'max:12'],
                'entry_invoice' => ['sometimes', 'boolean'],
                'agency_fee' => ['nullable', 'integer', 'min:0'],
            ] : []),
            'owner_id' => ['nullable', 'integer', $client],
            'agent_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('is_active', true)],
            'end_date' => ['nullable', 'date', $creating ? 'after:start_date' : 'after:today'],
            'rent' => [$required, 'integer', 'min:1'],
            'charges' => ['nullable', 'integer', 'min:0'],
            'due_day' => [$required, 'integer', 'min:1', 'max:28'],
            'rent_vat_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'managed' => ['sometimes', 'boolean'],
            'commission_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }
            /** @var Lease|null $lease */
            $lease = $this->route('lease');
            $property = $lease?->property ?? Property::find($this->input('property_id'));

            if (! $lease && $property && $property->transaction->value !== 'location') {
                $validator->errors()->add('property_id', 'Ce bien est à vendre, pas à louer.');
            }
            if (! $lease && $this->input('tenant_id') && (int) $this->input('tenant_id') === (int) ($this->input('owner_id') ?? $property?->owner_id)) {
                $validator->errors()->add('tenant_id', 'Le locataire ne peut pas être le propriétaire.');
            }

            $managed = $this->has('managed') ? $this->boolean('managed') : (bool) $lease?->managed;
            $owner = $this->input('owner_id') ?? $lease?->owner_id ?? $property?->owner_id;
            if ($managed && ! $owner) {
                $validator->errors()->add('owner_id', 'Un bail en gestion a besoin du propriétaire, à qui reverser les loyers.');
            }
        }];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'property_id' => 'bien', 'tenant_id' => 'locataire', 'owner_id' => 'propriétaire', 'start_date' => 'date d\'entrée',
            'end_date' => 'date de fin', 'rent' => 'loyer', 'due_day' => 'jour d\'échéance', 'deposit' => 'caution',
            'advance_months' => 'mois d\'avance', 'commission_rate' => 'commission',
        ];
    }
}
