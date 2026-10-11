<?php

namespace App\Http\Resources;

use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin User
 */
class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'phone' => $this->phone,
            'roles' => $this->roles->map(fn (Role $role) => [
                'id' => $role->id,
                'value' => $role->name,
                'label' => $role->label,
                'is_super_admin' => $role->isSuperAdmin(),
            ])->values(),
            'is_super_admin' => $this->isSuperAdmin(),
            // Permissions données au compte en plus de ses rôles.
            'direct_permissions' => $this->permissions->pluck('name')->sort()->values(),
            // Ce que le compte peut faire au total : le front s'en sert pour adapter les écrans.
            'permissions' => $this->effectivePermissions(),
            'is_active' => $this->is_active,
            'last_login_at' => $this->last_login_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
