<?php

namespace App\Http\Resources;

use App\Models\CompanySetting;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin CompanySetting
 */
class CompanySettingsResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'trade_name' => $this->trade_name,
            'legal_name' => $this->legal_name,
            'ninea' => $this->ninea,
            'rccm' => $this->rccm,
            'address' => $this->address,
            'city' => $this->city,
            'phone' => $this->phone,
            'whatsapp' => $this->whatsapp,
            'email' => $this->email,
            'website' => $this->website,
            'logo_url' => $this->logoUrl(),
            'bank_name' => $this->bank_name,
            'bank_account' => $this->bank_account,
            'vat_rate' => (float) $this->vat_rate,
            'currency' => $this->currency,
            'invoice_footer' => $this->invoice_footer,
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }
}
