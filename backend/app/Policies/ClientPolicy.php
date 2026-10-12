<?php

namespace App\Policies;

use App\Models\Client;
use App\Models\User;

/**
 * CRM : permissions « clients.* ». Les pièces d'identité restent visibles de l'agent qui suit le client,
 * et de ceux qui ont « clients.documents.view_all ».
 */
class ClientPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('clients.view');
    }

    public function view(User $user, Client $client): bool
    {
        return $user->hasPermission('clients.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermission('clients.create');
    }

    public function update(User $user, Client $client): bool
    {
        return $user->hasPermission('clients.update');
    }

    public function delete(User $user, Client $client): bool
    {
        return $user->hasPermission('clients.delete');
    }

    public function viewDocuments(User $user, Client $client): bool
    {
        return $user->hasPermission('clients.documents.view_all')
            || ($client->assigned_user_id === $user->id && $user->hasPermission('clients.view'));
    }

    public function manageDocuments(User $user, Client $client): bool
    {
        return $user->hasPermission('clients.documents.manage')
            || ($client->assigned_user_id === $user->id && $user->hasPermission('clients.update'));
    }

    /**
     * Critères de recherche et biens correspondants.
     */
    public function manageProspection(User $user, Client $client): bool
    {
        return $user->hasPermission('clients.prospection');
    }
}
