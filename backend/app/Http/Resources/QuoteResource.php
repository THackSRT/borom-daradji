<?php

namespace App\Http\Resources;

use App\Enums\QuoteStatus;
use App\Models\CompanySetting;
use App\Models\Quote;
use App\Models\QuoteLine;
use App\Models\QuoteLot;
use App\Services\Billing;
use App\Support\WhatsApp;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Quote
 */
class QuoteResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $user = $request->user();

        return [
            'id' => $this->id,
            'number' => $this->number,
            'is_template' => $this->is_template,
            'template_name' => $this->template_name,
            'status' => $this->status->toOption(),
            'title' => $this->title,
            'site_address' => $this->site_address,
            'client' => $this->whenLoaded('client', fn () => $this->client ? ['id' => $this->client->id, 'name' => $this->client->name, 'phone' => $this->client->phone] : null),
            'property' => $this->whenLoaded('property', fn () => $this->property ? ['id' => $this->property->id, 'reference' => $this->property->reference, 'title' => $this->property->title] : null),
            'worksite' => $this->whenLoaded('worksite', fn () => $this->worksite ? ['id' => $this->worksite->id, 'reference' => $this->worksite->reference, 'status' => $this->worksite->status->toOption()] : null),
            'issue_date' => $this->issue_date?->toDateString(),
            'valid_until' => $this->valid_until?->toDateString(),
            'discount_rate' => (float) $this->discount_rate,
            'deposit_rate' => (float) $this->deposit_rate,
            'deposit_amount' => $this->depositAmount(),
            'subtotal' => $this->subtotal,
            'discount_amount' => $this->discount_amount,
            'total_ht' => $this->total_ht,
            'vat_total' => $this->vat_total,
            'total' => $this->total,
            'conditions' => $this->conditions,
            'notes' => $this->notes,
            'sent_at' => $this->sent_at?->toIso8601String(),
            'decided_at' => $this->decided_at?->toIso8601String(),
            'refusal_reason' => $this->refusal_reason,
            'lots' => $this->whenLoaded('lots', fn () => $this->lots->map(fn (QuoteLot $lot) => [
                'id' => $lot->id,
                'title' => $lot->title,
                'trade_id' => $lot->trade_id,
                'total_ht' => $lot->total_ht,
                'lines' => $lot->relationLoaded('lines') ? $lot->lines->map(fn (QuoteLine $l) => [
                    'id' => $l->id,
                    'catalog_item_id' => $l->catalog_item_id,
                    'designation' => $l->designation,
                    'unit' => $l->unit,
                    'quantity' => (float) $l->quantity,
                    'unit_price' => $l->unit_price,
                    'vat_rate' => (float) $l->vat_rate,
                    'amount' => $l->amount,
                    'net_amount' => $l->net_amount,
                    'vat_amount' => $l->vat_amount,
                ]) : [],
            ])),
            'lots_count' => $this->whenCounted('lots'),
            'whatsapp_url' => $this->when(
                $this->status === QuoteStatus::Envoye && $this->relationLoaded('client') && $this->client,
                fn () => $this->whatsapp(),
            ),
            'creator' => $this->whenLoaded('creator', fn () => $this->creator ? ['id' => $this->creator->id, 'name' => $this->creator->name] : null),
            'can' => $user ? [
                'update' => $this->isDraft() && $user->can('update', $this->resource),
                'decide' => ! $this->is_template && $user->can('update', $this->resource),
                'delete' => $this->isDraft() && $user->can('delete', $this->resource),
            ] : null,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }

    private function whatsapp(): ?string
    {
        $company = CompanySetting::current()->trade_name;
        $text = "Bonjour {$this->client->name}, voici notre devis {$this->number} « {$this->title} » : "
            .Billing::money($this->total).' TTC, valable jusqu\'au '.$this->valid_until?->format('d/m/Y').'. '
            ."Nous vous envoyons le détail en PDF. — {$company}";

        return WhatsApp::link($this->client->whatsapp ?? $this->client->phone, $text);
    }
}
