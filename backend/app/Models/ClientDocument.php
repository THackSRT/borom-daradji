<?php

namespace App\Models;

use App\Enums\ClientDocumentType;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Pièce d'un client (CNI, passeport…), stockée sur le disque privé.
 */
#[Fillable(['client_id', 'type', 'path', 'original_name', 'uploaded_by'])]
class ClientDocument extends Model
{
    use LogsActivity;

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return ['type' => ClientDocumentType::class];
    }

    /**
     * @return BelongsTo<Client, $this>
     */
    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }
}
