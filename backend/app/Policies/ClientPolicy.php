<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\Client;
use App\Models\User;

/**
 * CRM : tous les rôles internes consultent et complètent les fiches ; seul le dirigeant archive
 * (Gate::before). Les pièces d'identité ne sont visibles que du dirigeant et de l'agent assigné.
 */
class ClientPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Client $client): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function update(User $user, Client $client): bool
    {
        return true;
    }

    public function delete(User $user, Client $client): bool
    {
        return false;
    }

    public function viewDocuments(User $user, Client $client): bool
    {
        return $client->assigned_user_id === $user->id;
    }

    public function manageDocuments(User $user, Client $client): bool
    {
        return $client->assigned_user_id === $user->id || $user->hasRole(Role::Agent, Role::Commercial);
    }

    /**
     * Critères de recherche et visites : métier des agents et commerciaux.
     */
    public function manageProspection(User $user, Client $client): bool
    {
        return $user->hasRole(Role::Agent, Role::Commercial);
    }
}
