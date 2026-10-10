<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Support\AccessGuard;
use App\Support\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorizeRead($request);

        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', 'string', Rule::exists('roles', 'name')],
            'active' => ['nullable', 'boolean'],
        ]);

        $users = User::query()
            ->with(['roles.permissions', 'permissions'])
            ->when($filters['search'] ?? null, function ($query, string $search) {
                $query->where(fn ($q) => $q
                    ->whereLike('name', "%{$search}%")
                    ->orWhereLike('email', "%{$search}%")
                    ->orWhereLike('phone', "%{$search}%"));
            })
            ->when($filters['role'] ?? null, fn ($query, string $role) => $query->withRole($role))
            ->when(isset($filters['active']), fn ($query) => $query->where('is_active', $request->boolean('active')))
            ->orderBy('name')
            ->paginate(25)
            ->withQueryString();

        return UserResource::collection($users);
    }

    public function store(StoreUserRequest $request): JsonResponse
    {
        $user = DB::transaction(function () use ($request) {
            $user = User::create($request->safe()->except(['roles', 'permissions']));
            $this->syncAccess($user, $request);

            return $user;
        });

        return (new UserResource($user->fresh()))->response()->setStatusCode(201);
    }

    public function show(Request $request, User $user): UserResource
    {
        $this->authorizeRead($request);

        return new UserResource($user);
    }

    public function update(UpdateUserRequest $request, User $user): UserResource
    {
        DB::transaction(function () use ($request, $user) {
            $user->update($request->safe()->except(['roles', 'permissions']));
            $this->syncAccess($user, $request);
        });

        if (! $user->is_active) {
            $user->tokens()->delete();
        }

        return new UserResource($user->fresh());
    }

    /**
     * Pas de suppression physique : un compte désactivé garde son historique (journal, documents créés).
     */
    public function destroy(Request $request, User $user): Response
    {
        abort_unless($request->user()->can('users.manage'), 403);

        if ($user->is($request->user())) {
            throw ValidationException::withMessages(['user' => 'Vous ne pouvez pas désactiver votre propre compte.']);
        }
        if ($user->isSuperAdmin() && ! $request->user()->isSuperAdmin()) {
            throw ValidationException::withMessages(['user' => 'Seul un dirigeant peut désactiver le compte d\'un dirigeant.']);
        }
        if ($user->isSuperAdmin() && AccessGuard::activeSuperAdminCount(except: $user) === 0) {
            throw ValidationException::withMessages(['user' => 'C\'est le dernier dirigeant actif : nommez-en un autre avant.']);
        }

        $user->update(['is_active' => false]);
        $user->tokens()->delete();

        return response()->noContent();
    }

    private function authorizeRead(Request $request): void
    {
        abort_unless($request->user()->hasPermission('users.view', 'users.manage'), 403);
    }

    /**
     * Rôles et permissions individuelles, avec une trace avant/après dans le journal.
     */
    private function syncAccess(User $user, Request $request): void
    {
        if (! $request->has('roles') && ! $request->has('permissions')) {
            return;
        }

        $before = ['roles' => $user->roles()->pluck('name')->sort()->values()->all(), 'permissions' => $user->permissions()->pluck('name')->sort()->values()->all()];

        if ($request->has('roles')) {
            $user->syncRoles((array) $request->input('roles'));
        }
        if ($request->has('permissions')) {
            $user->syncPermissions((array) $request->input('permissions'));
        }

        $user->unsetRelation('roles')->unsetRelation('permissions');
        $after = ['roles' => $user->roles()->pluck('name')->sort()->values()->all(), 'permissions' => $user->permissions()->pluck('name')->sort()->values()->all()];

        $changes = [];
        foreach (['roles', 'permissions'] as $key) {
            if ($before[$key] !== $after[$key]) {
                $changes[$key] = ['old' => $before[$key], 'new' => $after[$key]];
            }
        }
        if ($changes) {
            ActivityLogger::log('access_changed', $user, "Droits de {$user->name} modifiés", $changes);
        }
    }
}
