<?php

namespace App\Models;

use App\Models\Concerns\LogsActivity;
use App\Support\PermissionCatalog;
use Spatie\Permission\Models\Role as SpatieRole;

/**
 * Rôle (RBAC) : un nom technique, un libellé, une description et des permissions.
 * Les rôles « système » sont fournis par défaut et ne se suppriment pas ; le dirigeant a tout.
 */
class Role extends SpatieRole
{
    use LogsActivity;

    /** Garde unique de l'application : les jetons Sanctum s'authentifient sur le fournisseur « users ». */
    protected $guard_name = 'web';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['is_system' => 'boolean'];
    }

    public function isSuperAdmin(): bool
    {
        return $this->name === PermissionCatalog::SUPER_ADMIN;
    }

    /**
     * Permissions effectives du rôle (toutes pour le super-administrateur).
     *
     * @return list<string>
     */
    public function permissionNames(): array
    {
        return $this->isSuperAdmin()
            ? PermissionCatalog::names()
            : $this->permissions->pluck('name')->sort()->values()->all();
    }
}
