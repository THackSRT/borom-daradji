<?php

namespace App\Http\Controllers\Api;

use App\Enums\Role;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', Rule::enum(Role::class)],
            'active' => ['nullable', 'boolean'],
        ]);

        $users = User::query()
            ->when($filters['search'] ?? null, function ($query, string $search) {
                $query->where(fn ($q) => $q
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%"));
            })
            ->when($filters['role'] ?? null, fn ($query, string $role) => $query->withRole(Role::from($role)))
            ->when(isset($filters['active']), fn ($query) => $query->where('is_active', $request->boolean('active')))
            ->orderBy('name')
            ->paginate(25)
            ->withQueryString();

        return UserResource::collection($users);
    }

    public function store(StoreUserRequest $request): UserResource
    {
        $user = User::create($request->validated());

        return new UserResource($user);
    }

    public function show(User $user): UserResource
    {
        return new UserResource($user);
    }

    public function update(UpdateUserRequest $request, User $user): UserResource
    {
        $user->update($request->validated());

        if (! $user->is_active) {
            $user->tokens()->delete();
        }

        return new UserResource($user);
    }

    /**
     * Pas de suppression physique : un compte désactivé garde son historique (journal, documents créés).
     */
    public function destroy(Request $request, User $user): Response
    {
        if ($user->is($request->user())) {
            throw ValidationException::withMessages([
                'user' => 'Vous ne pouvez pas désactiver votre propre compte.',
            ]);
        }

        $user->update(['is_active' => false]);
        $user->tokens()->delete();

        return response()->noContent();
    }
}
