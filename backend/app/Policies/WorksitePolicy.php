<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Worksite;

/**
 * Chantiers : consultation « works.view », gestion « works.manage », budgets et coûts « works.costs ».
 */
class WorksitePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('works.view');
    }

    public function view(User $user, Worksite $worksite): bool
    {
        return $user->hasPermission('works.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermission('works.manage');
    }

    public function update(User $user, Worksite $worksite): bool
    {
        return $user->hasPermission('works.manage');
    }

    public function viewCosts(User $user, Worksite $worksite): bool
    {
        return $user->hasPermission('works.costs');
    }
}
