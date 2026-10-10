<?php

namespace App\Policies;

use App\Models\Task;
use App\Models\User;

/**
 * Chacun gère ses tâches et celles qu'il a créées ; le dirigeant voit tout (Gate::before).
 */
class TaskPolicy
{
    public function update(User $user, Task $task): bool
    {
        return $task->user_id === $user->id || $task->created_by === $user->id;
    }

    public function delete(User $user, Task $task): bool
    {
        return $task->created_by === $user->id;
    }

    public function viewAll(User $user): bool
    {
        return false;
    }
}
