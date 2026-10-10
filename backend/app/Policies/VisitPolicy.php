<?php

namespace App\Policies;

use App\Models\User;
use App\Models\Visit;

class VisitPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('visits.view', 'visits.manage');
    }

    public function create(User $user): bool
    {
        return $user->hasPermission('visits.manage');
    }

    public function update(User $user, Visit $visit): bool
    {
        return $user->hasPermission('visits.manage');
    }
}
