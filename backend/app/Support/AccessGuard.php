<?php

namespace App\Support;

use App\Models\Role;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/**
 * Garde-fous du RBAC, communs aux comptes et aux rôles :
 * - pas d'escalade : on ne donne que des permissions qu'on a soi-même ;
 * - le rôle dirigeant (super-administrateur) n'est attribué ou retiré que par un dirigeant ;
 * - il reste toujours au moins un dirigeant actif.
 */
final class AccessGuard
{
    /**
     * @param  list<string>  $permissions  permissions qu'on s'apprête à donner (directement ou via des rôles)
     */
    public static function ensureCanGrant(User $actor, array $permissions, string $field): void
    {
        if ($actor->isSuperAdmin()) {
            return;
        }

        $missing = array_values(array_diff($permissions, $actor->effectivePermissions()));
        if ($missing) {
            $labels = array_map(fn (string $name) => PermissionCatalog::all()[$name]['label'] ?? $name, $missing);
            throw ValidationException::withMessages([
                $field => 'Vous ne pouvez pas donner des droits que vous n\'avez pas : '.implode(', ', $labels).'.',
            ]);
        }
    }

    /**
     * @param  list<string>  $roleNames
     * @return list<string> permissions apportées par ces rôles
     */
    public static function permissionsOfRoles(array $roleNames): array
    {
        return Role::query()->with('permissions')->whereIn('name', $roleNames)->get()
            ->flatMap(fn (Role $role) => $role->permissionNames())
            ->unique()->values()->all();
    }

    public static function activeSuperAdminCount(?User $except = null): int
    {
        return User::query()->active()->withRole(PermissionCatalog::SUPER_ADMIN)
            ->when($except, fn ($q) => $q->whereKeyNot($except->getKey()))
            ->count();
    }
}
