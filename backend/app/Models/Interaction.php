<?php

namespace App\Models;

use App\Enums\InteractionChannel;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Un échange avec un client (appel, message WhatsApp, visite, formulaire du site…).
 */
#[Fillable(['client_id', 'user_id', 'property_id', 'channel', 'summary', 'occurred_at'])]
class Interaction extends Model
{
    use LogsActivity;

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'channel' => InteractionChannel::class,
            'occurred_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::created(function (Interaction $interaction) {
            $client = $interaction->client;
            $client->recordContact($interaction->occurred_at);
            $client->save();
        });
    }

    /**
     * @return BelongsTo<Client, $this>
     */
    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<Property, $this>
     */
    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }
}
