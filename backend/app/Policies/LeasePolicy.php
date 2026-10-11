<?php

namespace App\Policies;

use App\Models\Lease;
use App\Models\User;

/**
 * Baux et états des lieux : permissions « leases.* » ; caution : « deposits.settle ».
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

    /**
     * Restitution de la caution en fin de bail (mouvement d'argent : permission distincte).
     */
    public function settleDeposit(User $user, Lease $lease): bool
    {
        return $user->hasPermission('deposits.settle');
    }
}
