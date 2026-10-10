<?php

namespace App\Policies;

use App\Models\Lease;
use App\Models\User;

/**
 * Baux : permissions « leases.* ».
 */
class LeasePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('leases.view');
    }

    public function view(User $user, Lease $lease): bool
    {
        return $user->hasPermission('leases.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermission('leases.manage');
    }

    public function update(User $user, Lease $lease): bool
    {
        return $user->hasPermission('leases.manage');
    }
}
