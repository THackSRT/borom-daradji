<?php

namespace App\Http\Requests\Concerns;

use App\Models\User;
use App\Support\AccessGuard;
use App\Support\PermissionCatalog;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Validator;

/**
 * Règles communes à la création et à la modification d'un compte : rôles et permissions individuelles.
 */
trait ValidatesAccess
{
    /**
     * @return array<string, mixed>
     */
    protected function accessRules(string $required): array
    {
        return [
            'roles' => [$required, 'array'],
            'roles.*' => ['distinct', 'string', Rule::exists('roles', 'name')],
            'permissions' => ['sometimes', 'array'],
            'permissions.*' => ['distinct', Rule::in(PermissionCatalog::names())],
        ];
    }

    /**
     * Garde-fous : pas d'escalade, rôle dirigeant réservé aux dirigeants, un compte doit avoir des droits.
     */
    protected function validateAccess(Validator $validator, ?User $target): void
    {
        if ($validator->errors()->isNotEmpty()) {
            return;
        }

        /** @var User $actor */
        $actor = $this->user();
        $roles = $this->has('roles') ? (array) $this->input('roles') : $target?->roles->pluck('name')->all() ?? [];
        $permissions = $this->has('permissions') ? (array) $this->input('permissions') : $target?->permissions->pluck('name')->all() ?? [];

        if (! $roles && ! $permissions) {
            $validator->errors()->add('roles', 'Attribuez au moins un rôle (ou des droits individuels).');

            return;
        }

        $superAdmin = PermissionCatalog::SUPER_ADMIN;
        $wasSuperAdmin = $target?->isSuperAdmin() ?? false;
        $becomesSuperAdmin = in_array($superAdmin, $roles, true);

        if (! $actor->isSuperAdmin()) {
            if ($target?->is($actor) && ($this->has('roles') || $this->has('permissions'))) {
                $validator->errors()->add('roles', 'Vous ne pouvez pas modifier vos propres droits.');

                return;
            }
            if ($wasSuperAdmin || $becomesSuperAdmin) {
                $validator->errors()->add('roles', 'Seul un dirigeant peut attribuer, retirer ou modifier le rôle dirigeant.');

                return;
            }
        }

        // Pas d'escalade : on ne donne que ce qu'on a (seuls les ajouts sont contrôlés).
        $currentPermissions = $target ? $target->effectivePermissions() : [];
        $granted = array_unique([...AccessGuard::permissionsOfRoles($roles), ...$permissions]);
        $added = array_values(array_diff($granted, $currentPermissions));
        try {
            AccessGuard::ensureCanGrant($actor, $added, 'roles');
        } catch (ValidationException $e) {
            $validator->errors()->add('roles', $e->validator->errors()->first('roles'));

            return;
        }

        // Il reste toujours un dirigeant actif.
        $deactivated = $this->has('is_active') && ! $this->boolean('is_active');
        if ($wasSuperAdmin && (! $becomesSuperAdmin || $deactivated) && AccessGuard::activeSuperAdminCount(except: $target) === 0) {
            $validator->errors()->add($deactivated ? 'is_active' : 'roles', 'C\'est le dernier dirigeant actif : nommez-en un autre avant.');
        }
    }
}
