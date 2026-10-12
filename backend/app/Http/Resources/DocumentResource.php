<?php

namespace App\Http\Resources;

use App\Models\ClientDocument;
use App\Models\PropertyDocument;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Pièce d'un bien ou d'un client. Le fichier se télécharge par une route protégée, jamais par une URL publique.
 *
 * @mixin PropertyDocument|ClientDocument
 */
class DocumentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type->toOption(),
            'original_name' => $this->original_name,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
