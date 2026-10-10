<?php

namespace App\Http\Resources;

use App\Models\CompanySetting;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Coordonnées publiques affichées sur le site vitrine (sans données bancaires ni fiscales).
 *
 * @mixin CompanySetting
 */
class PublicCompanyResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'trade_name' => $this->trade_name,
            'address' => $this->address,
            'city' => $this->city,
            'phone' => $this->phone,
            'whatsapp' => $this->whatsapp,
            'email' => $this->email,
            'website' => $this->website,
            'logo_url' => $this->logoUrl(),
        ];
    }
}
