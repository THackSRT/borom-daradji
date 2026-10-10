<?php

namespace App\Http\Resources;

use App\Models\CompanySetting;
use App\Models\Lease;
use App\Models\RentCall;
use App\Services\Billing;
use App\Support\WhatsApp;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Collection;

/**
 * @mixin Lease
 */
class LeaseResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $user = $request->user();
        $overdue = $this->relationLoaded('rentCalls') ? $this->overdueCalls() : collect();

        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'status' => $this->status->toOption(),
            'property' => $this->whenLoaded('property', fn () => ['id' => $this->property->id, 'reference' => $this->property->reference, 'title' => $this->property->title]),
            'tenant' => $this->whenLoaded('tenant', fn () => ['id' => $this->tenant->id, 'name' => $this->tenant->name, 'phone' => $this->tenant->phone]),
            'owner' => $this->whenLoaded('owner', fn () => $this->owner ? ['id' => $this->owner->id, 'name' => $this->owner->name] : null),
            'agent' => $this->whenLoaded('agent', fn () => $this->agent ? ['id' => $this->agent->id, 'name' => $this->agent->name] : null),
            'start_date' => $this->start_date->toDateString(),
            'end_date' => $this->end_date?->toDateString(),
            'billing_start' => $this->billing_start->toDateString(),
            'rent' => $this->rent,
            'charges' => $this->charges,
            'deposit' => $this->deposit,
            'advance_months' => $this->advance_months,
            'due_day' => $this->due_day,
            'rent_vat_rate' => (float) $this->rent_vat_rate,
            'managed' => $this->managed,
            'commission_rate' => (float) $this->commission_rate,
            'terminated_on' => $this->terminated_on?->toDateString(),
            'termination_reason' => $this->termination_reason,
            'notes' => $this->notes,
            'entry_invoice' => $this->whenLoaded('entryInvoice', fn () => $this->entryInvoice ? [
                'id' => $this->entryInvoice->id,
                'number' => $this->entryInvoice->number,
                'status' => $this->entryInvoice->status->toOption(),
                'total' => $this->entryInvoice->total,
                'balance' => $this->entryInvoice->balance(),
            ] : null),
            'arrears' => $this->when($this->relationLoaded('rentCalls'), fn () => (int) $overdue->sum(fn (RentCall $c) => max(0, $c->invoice->balance()))),
            'months_overdue' => $this->when($this->relationLoaded('rentCalls'), fn () => $overdue->count()),
            'rent_calls' => $this->whenLoaded('rentCalls', fn () => $this->rentCalls->map(fn (RentCall $call) => [
                'id' => $call->id,
                'period' => $call->period->toDateString(),
                'invoice' => [
                    'id' => $call->invoice->id,
                    'number' => $call->invoice->number,
                    'status' => $call->invoice->status->toOption(),
                    'due_date' => $call->invoice->due_date?->toDateString(),
                    'total' => $call->invoice->total,
                    'paid_total' => $call->invoice->paid_total,
                    'balance' => $call->invoice->balance(),
                    'payment_state' => $call->invoice->paymentState()?->toOption(),
                    'is_overdue' => $call->invoice->isOverdue(),
                ],
                'can_quittance' => $call->isPaid(),
            ])),
            'whatsapp_reminder_url' => $this->when(
                $this->relationLoaded('rentCalls') && $this->relationLoaded('tenant') && $overdue->isNotEmpty(),
                fn () => $this->reminder($overdue),
            ),
            'can' => $user ? ['update' => $this->isActive() && $user->can('update', $this->resource)] : null,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    /**
     * @param  Collection<int, RentCall>  $overdue
     */
    private function reminder($overdue): ?string
    {
        $months = $overdue->sortBy(fn (RentCall $c) => $c->period)->map(fn (RentCall $c) => $c->period->locale('fr')->translatedFormat('F Y'))->join(', ', ' et ');
        $total = (int) $overdue->sum(fn (RentCall $c) => max(0, $c->invoice->balance()));
        $company = CompanySetting::current()->trade_name;
        $text = "Bonjour {$this->tenant->name}, sauf erreur de notre part, le loyer de {$months} ({$this->property->title}) "
            .'reste à régler : '.Billing::money($total).'. Vous pouvez payer en espèces, par Wave ou Orange Money. '
            ."Merci. — {$company}";

        return WhatsApp::link($this->tenant->whatsapp ?? $this->tenant->phone, $text);
    }
}
