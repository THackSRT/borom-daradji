<?php

namespace App\Services;

use App\Enums\ClientCategory;
use App\Enums\InteractionChannel;
use App\Enums\LeadSource;
use App\Enums\TaskPriority;
use App\Enums\TransactionType;
use App\Models\Client;
use App\Models\Property;
use App\Models\Task;
use App\Models\User;
use App\Support\PermissionCatalog;
use Illuminate\Support\Facades\DB;

/**
 * Transforme une demande envoyée depuis le site en prospect suivi : client retrouvé par
 * téléphone (ou créé), échange enregistré, tâche « rappeler sous 24 h » pour l'agent.
 */
class LeadIntake
{
    /**
     * @param  array{name: string, phone: string, email?: string|null, message: string}  $data
     */
    public function handle(array $data, ?Property $property = null): Client
    {
        return DB::transaction(function () use ($data, $property) {
            $client = Client::firstOrNew(['phone' => $data['phone']]);

            if (! $client->exists) {
                $client->fill([
                    'name' => $data['name'],
                    'email' => $data['email'] ?? null,
                    'source' => LeadSource::Site,
                    'assigned_user_id' => $property?->agent_id ?? $this->fallbackAssignee()?->id,
                ]);
            }

            $category = $property?->transaction === TransactionType::Location ? ClientCategory::Locataire : ClientCategory::Acheteur;
            if ($property && ! $client->categories->contains($category)) {
                $client->categories = $client->categories->push($category);
            }

            $client->email ??= $data['email'] ?? null;
            $client->save();

            $client->interactions()->create([
                'channel' => InteractionChannel::FormulaireSite,
                'property_id' => $property?->id,
                'summary' => $data['message'],
                'occurred_at' => now(),
            ]);

            Task::create([
                'user_id' => $property?->agent_id ?? $client->assigned_user_id ?? $this->fallbackAssignee()?->id,
                'client_id' => $client->id,
                'property_id' => $property?->id,
                'title' => "Rappeler {$client->name} (demande du site)",
                'details' => $data['message'],
                'due_at' => now()->addDay(),
                'priority' => TaskPriority::Haute,
            ]);

            return $client;
        });
    }

    /**
     * Sans agent désigné, la demande va au premier dirigeant actif.
     */
    private function fallbackAssignee(): ?User
    {
        return User::active()->withRole(PermissionCatalog::SUPER_ADMIN)->orderBy('id')->first();
    }
}
