<?php

namespace App\Policies;

use App\Models\Task;
use App\Models\User;

/**
 * Chacun gère ses tâches et celles qu'il a créées ; « tasks.manage_all » donne accès à celles de l'équipe.
 */
class TaskPolicy
{
    public function update(User $user, Task $task): bool
    {
        return $task->user_id === $user->id || $task->created_by === $user->id || $user->hasPermission('tasks.manage_all');
    }

    public function delete(User $user, Task $task): bool
    {
        return $task->created_by === $user->id || $user->hasPermission('tasks.manage_all');
    }

    public function viewAll(User $user): bool
    {
        return $user->hasPermission('tasks.manage_all');
    }
}
