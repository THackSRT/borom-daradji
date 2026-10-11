<?php

namespace App\Http\Resources;

use App\Models\CompanySetting;
use App\Models\Invoice;
use App\Models\InvoiceLine;
use App\Services\Billing;
use App\Support\WhatsApp;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Invoice
 */
class InvoiceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $user = $request->user();

        return [
            'id' => $this->id,
            'type' => $this->type->toOption(),
            'number' => $this->number,
            'status' => $this->status->toOption(),
            'payment_state' => $this->paymentState()?->toOption(),
            'is_overdue' => $this->isOverdue(),
            'client' => $this->whenLoaded('client', fn () => [
                'id' => $this->client->id,
                'name' => $this->client->name,
                'phone' => $this->client->phone,
            ]),
            'property' => $this->whenLoaded('property', fn () => $this->property ? [
                'id' => $this->property->id,
                'reference' => $this->property->reference,
                'title' => $this->property->title,
            ] : null),
            'activity' => $this->activity->toOption(),
            'credited_invoice' => $this->whenLoaded('creditedInvoice', fn () => $this->creditedInvoice ? [
                'id' => $this->creditedInvoice->id,
                'number' => $this->creditedInvoice->number,
            ] : null),
            'issue_date' => $this->issue_date?->toDateString(),
            'due_date' => $this->due_date?->toDateString(),
            'subtotal' => $this->subtotal,
            'vat_total' => $this->vat_total,
            'total' => $this->total,
            'paid_total' => $this->paid_total,
            'credited_total' => $this->credited_total,
            'balance' => $this->balance(),
            'notes' => $this->notes,
            'lines' => $this->whenLoaded('lines', fn () => $this->lines->map(fn (InvoiceLine $line) => [
                'id' => $line->id,
                'description' => $line->description,
                'quantity' => (float) $line->quantity,
                'unit' => $line->unit,
                'unit_price' => $line->unit_price,
                'vat_rate' => (float) $line->vat_rate,
                'amount' => $line->amount,
                'vat_amount' => $line->vat_amount,
            ])),
            'payments' => PaymentResource::collection($this->whenLoaded('payments')),
            'credit_notes' => $this->whenLoaded('creditNotes', fn () => $this->creditNotes->map(fn (Invoice $note) => [
                'id' => $note->id,
                'number' => $note->number,
                'status' => $note->status->toOption(),
                'total' => $note->total,
            ])),
            'whatsapp_reminder_url' => $this->whenLoaded('client', fn () => $this->balance() > 0 ? $this->reminderLink() : null),
            'issued_at' => $this->issued_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'can' => $user ? [
                'update' => $this->isDraft() && $user->can('update', $this->resource),
                'issue' => $this->isDraft() && $user->can('issue', $this->resource),
                'delete' => $this->isDraft() && $user->can('delete', $this->resource),
                'credit' => ! $this->isDraft() && ! $this->isCreditNote() && $this->total > $this->credited_total && $user->can('credit', $this->resource),
                'pay' => $this->balance() > 0 && $user->can('recordPayment', $this->resource),
                'cancel_payment' => $user->can('cancelPayment', Invoice::class),
            ] : null,
        ];
    }

    private function reminderLink(): ?string
    {
        $company = CompanySetting::current()->trade_name;
        $due = $this->due_date ? ' (échéance du '.$this->due_date->format('d/m/Y').')' : '';
        $text = "Bonjour {$this->client->name}, sauf erreur de notre part, la facture {$this->number}{$due} "
            .'présente un reste à payer de '.Billing::money($this->balance()).'. '
            ."Vous pouvez régler en espèces, par Wave ou Orange Money. Merci. — {$company}";

        return WhatsApp::link($this->client->whatsapp ?? $this->client->phone, $text);
    }
}
