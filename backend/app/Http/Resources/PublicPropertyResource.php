<?php

namespace App\Http\Resources;

use App\Models\CompanySetting;
use App\Models\Property;
use App\Support\WhatsApp;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Bien tel qu'affiché sur le site vitrine : ni propriétaire, ni adresse exacte, ni documents.
 *
 * @mixin Property
 */
class PublicPropertyResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $company = CompanySetting::current();

        return [
            'reference' => $this->reference,
            'slug' => $this->slug,
            'title' => $this->title,
            'type' => $this->type->toOption(),
            'transaction' => $this->transaction->toOption(),
            'status' => $this->status->toOption(),
            'price' => $this->price,
            'charges' => $this->charges,
            'deposit_months' => $this->deposit_months,
            'advance_months' => $this->advance_months,
            'surface' => $this->surface,
            'land_surface' => $this->land_surface,
            'rooms' => $this->rooms,
            'bedrooms' => $this->bedrooms,
            'bathrooms' => $this->bathrooms,
            'features' => $this->features,
            'city' => $this->city,
            'neighborhood' => $this->neighborhood,
            'description' => $this->description,
            'land_status' => $this->land_status->toOption(),
            'is_featured' => $this->is_featured,
            'cover_url' => $this->cover?->url(),
            'photos' => $this->whenLoaded('photos', fn () => $this->photos->map->url()),
            'whatsapp_url' => WhatsApp::link(
                $company->whatsapp ?? $company->phone,
                "Bonjour, je suis intéressé(e) par le bien {$this->reference} : {$this->title}.",
            ),
            'published_at' => $this->published_at?->toIso8601String(),
        ];
    }
}
