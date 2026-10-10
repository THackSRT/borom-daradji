<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\User;
use App\Models\Visit;

class VisitPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(Role::Agent, Role::Commercial);
    }

    public function create(User $user): bool
    {
        return $user->hasRole(Role::Agent, Role::Commercial);
    }

    public function update(User $user, Visit $visit): bool
    {
        return $user->hasRole(Role::Agent, Role::Commercial);
    }
}
