<?php

namespace App\Policies;

use App\Models\Property;
use App\Models\User;

/**
 * Biens : permissions « properties.* » (catalogue dans App\Support\PermissionCatalog).
 * Le dirigeant passe par Gate::before.
 */
class PropertyPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('properties.view');
    }

    public function view(User $user, Property $property): bool
    {
        return $user->hasPermission('properties.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermission('properties.create');
    }

    /**
     * Fiche, photos, vérification foncière, statut, mandats.
     */
    public function update(User $user, Property $property): bool
    {
        return $user->hasPermission('properties.update');
    }

    public function delete(User $user, Property $property): bool
    {
        return $user->hasPermission('properties.delete');
    }

    /**
     * Titre foncier, mandat scanné, pièces du propriétaire.
     */
    public function viewDocuments(User $user, Property $property): bool
    {
        return $user->hasPermission('properties.documents');
    }

    public function viewMandates(User $user, Property $property): bool
    {
        return $user->hasPermission('properties.mandates');
    }
}
