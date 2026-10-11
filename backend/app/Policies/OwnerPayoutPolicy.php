<?php

namespace App\Policies;

use App\Models\OwnerPayout;
use App\Models\User;

/**
 * Reversements aux propriétaires : permissions « payouts.* ».
 */
class OwnerPayoutPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('payouts.view', 'payouts.manage');
    }

    public function view(User $user, OwnerPayout $payout): bool
    {
        return $this->viewAny($user);
    }

    public function create(User $user): bool
    {
        return $user->hasPermission('payouts.manage');
    }

    public function cancel(User $user, OwnerPayout $payout): bool
    {
        return $user->hasPermission('payouts.manage');
    }
}
