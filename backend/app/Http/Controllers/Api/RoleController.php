<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\RoleRequest;
use App\Http\Resources\RoleResource;
use App\Models\Role;
use App\Support\AccessGuard;
use App\Support\ActivityLogger;
use App\Support\PermissionCatalog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Rôles (RBAC) : création, permissions, duplication, suppression. Lecture ouverte à qui gère ou
 * consulte les comptes ; écriture réservée à « roles.manage ».
 */
class RoleController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorizeRead($request);

        $roles = Role::query()->with('permissions')->withCount('users')
            ->orderByRaw('name = ? desc', [PermissionCatalog::SUPER_ADMIN])
            ->orderByDesc('is_system')->orderBy('label')->get();

        return RoleResource::collection($roles);
    }

    /**
     * Catalogue des permissions par module, et quels rôles ont chacune : la matrice des droits.
     */
    public function permissions(Request $request): JsonResponse
    {
        $this->authorizeRead($request);

        $holders = Role::query()->with('permissions')->get()
            ->flatMap(fn (Role $role) => array_map(fn ($p) => [$p, $role->name], $role->permissionNames()))
            ->groupBy(0)->map(fn ($rows) => $rows->pluck(1)->values());

        $modules = [];
        foreach (PermissionCatalog::modules() as $key => $module) {
            $modules[] = [
                'key' => $key,
                'label' => $module['label'],
                'permissions' => collect($module['permissions'])->map(fn ($definition, $name) => [
                    'name' => $name,
                    'label' => $definition[0],
                    'description' => $definition[1] ?: null,
                    'roles' => $holders[$name] ?? [],
                ])->values(),
            ];
        }

        return response()->json(['data' => $modules]);
    }

    public function show(Request $request, Role $role): RoleResource
    {
        $this->authorizeRead($request);

        return new RoleResource($role->load('permissions')->loadCount('users'));
    }

    public function store(RoleRequest $request): RoleResource
    {
        $permissions = $request->validated('permissions');
        AccessGuard::ensureCanGrant($request->user(), $permissions, 'permissions');

        $role = DB::transaction(function () use ($request, $permissions) {
            $role = Role::create([
                'name' => $this->uniqueName($request->validated('label')),
                'guard_name' => 'web',
                'label' => $request->validated('label'),
                'description' => $request->validated('description'),
                'is_system' => false,
            ]);
            $this->syncPermissions($role, $permissions);

            return $role;
        });

        return new RoleResource($role->load('permissions')->loadCount('users'));
    }

    public function update(RoleRequest $request, Role $role): RoleResource
    {
        if ($role->isSuperAdmin()) {
            throw ValidationException::withMessages(['role' => 'Le rôle dirigeant a toujours tous les droits : il ne se modifie pas.']);
        }

        DB::transaction(function () use ($request, $role) {
            $role->update($request->safe()->only(['label', 'description']));

            if ($request->has('permissions')) {
                $permissions = $request->validated('permissions');
                // Ce qu'on ajoute doit être à soi ; retirer reste possible.
                AccessGuard::ensureCanGrant($request->user(), array_values(array_diff($permissions, $role->permissionNames())), 'permissions');
                $this->syncPermissions($role, $permissions);
            }
        });

        return new RoleResource($role->load('permissions')->loadCount('users'));
    }

    public function duplicate(Request $request, Role $role): RoleResource
    {
        Gate::authorize('roles.manage');

        $permissions = $role->isSuperAdmin() ? PermissionCatalog::names() : $role->permissionNames();
        AccessGuard::ensureCanGrant($request->user(), $permissions, 'role');

        $label = $this->uniqueLabel('Copie de '.$role->label);
        $copy = Role::create([
            'name' => $this->uniqueName($label),
            'guard_name' => 'web',
            'label' => $label,
            'description' => $role->description,
            'is_system' => false,
        ]);
        $this->syncPermissions($copy, $permissions);

        return new RoleResource($copy->load('permissions')->loadCount('users'));
    }

    public function destroy(Role $role): Response
    {
        Gate::authorize('roles.manage');

        if ($role->is_system) {
            throw ValidationException::withMessages(['role' => 'Un rôle fourni par défaut ne se supprime pas ; vous pouvez changer ses droits.']);
        }

        $count = $role->users()->count();
        if ($count > 0) {
            throw ValidationException::withMessages([
                'role' => "Ce rôle est attribué à {$count} compte(s) : retirez-le-leur avant de le supprimer.",
            ]);
        }

        $role->delete();

        return response()->noContent();
    }

    private function authorizeRead(Request $request): void
    {
        abort_unless($request->user()->hasPermission('roles.manage', 'users.view', 'users.manage'), 403);
    }

    /**
     * @param  list<string>  $permissions
     */
    private function syncPermissions(Role $role, array $permissions): void
    {
        $before = $role->permissions()->pluck('name')->sort()->values()->all();
        $role->syncPermissions($permissions);
        $after = $role->permissions()->pluck('name')->sort()->values()->all();

        if ($before !== $after) {
            ActivityLogger::log('permissions_changed', $role, "Droits du rôle « {$role->label} » modifiés", [
                'permissions' => ['old' => $before, 'new' => $after],
            ]);
        }
    }

    private function uniqueName(string $label): string
    {
        $base = Str::slug($label, '_') ?: 'role';
        $name = $base;
        for ($i = 2; Role::query()->where('name', $name)->exists(); $i++) {
            $name = "{$base}_{$i}";
        }

        return $name;
    }

    private function uniqueLabel(string $label): string
    {
        $candidate = $label;
        for ($i = 2; Role::query()->where('label', $candidate)->exists(); $i++) {
            $candidate = "{$label} ({$i})";
        }

        return $candidate;
    }
}
