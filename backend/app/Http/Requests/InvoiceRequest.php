<?php

namespace App\Http\Requests;

use App\Enums\Activity;
use App\Models\Invoice;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Création ou modification d'un brouillon de facture ou d'avoir, avec toutes ses lignes.
 */
class InvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        $invoice = $this->route('invoice');

        return $invoice instanceof Invoice
            ? $this->user()->can('update', $invoice)
            : $this->user()->can('create', Invoice::class);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $invoice = $this->route('invoice');
        // Un avoir reste rattaché au client de la facture d'origine.
        $clientRule = $invoice instanceof Invoice && $invoice->isCreditNote() ? 'prohibited' : 'required';

        return [
            'client_id' => [$clientRule, 'integer', Rule::exists('clients', 'id')->whereNull('deleted_at')],
            'property_id' => ['nullable', 'integer', Rule::exists('properties', 'id')->whereNull('deleted_at')],
            'activity' => ['required', Rule::enum(Activity::class)],
            'issue_date' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date', 'after_or_equal:issue_date'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'lines' => ['required', 'array', 'min:1', 'max:100'],
            'lines.*.description' => ['required', 'string', 'max:500'],
            'lines.*.quantity' => ['required', 'numeric', 'gt:0', 'max:999999'],
            'lines.*.unit' => ['nullable', 'string', 'max:20'],
            'lines.*.unit_price' => ['required', 'integer', 'min:0', 'max:999999999999'],
            'lines.*.vat_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'client_id' => 'client',
            'lines' => 'lignes',
            'lines.*.description' => 'désignation',
            'lines.*.quantity' => 'quantité',
            'lines.*.unit_price' => 'prix unitaire',
            'lines.*.vat_rate' => 'TVA',
        ];
    }
}
