<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\Property;
use App\Models\User;

/**
 * Biens : agents en écriture ; responsable travaux, comptable et commercial en lecture (matrice v2.0).
 * Le dirigeant passe par Gate::before.
 */
class PropertyPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Property $property): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->hasRole(Role::Agent);
    }

    /**
     * Fiche, photos, vérification foncière, statut, mandats.
     */
    public function update(User $user, Property $property): bool
    {
        return $user->hasRole(Role::Agent);
    }

    public function delete(User $user, Property $property): bool
    {
        return $user->hasRole(Role::Agent);
    }

    /**
     * Titre foncier, mandat scanné, pièces du propriétaire.
     */
    public function viewDocuments(User $user, Property $property): bool
    {
        return $user->hasRole(Role::Agent);
    }

    public function viewMandates(User $user, Property $property): bool
    {
        return $user->hasRole(Role::Agent, Role::Comptable);
    }
}
