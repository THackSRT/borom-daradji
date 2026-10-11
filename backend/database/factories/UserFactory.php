<?php

namespace Database\Factories;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'phone' => '+2217'.fake()->unique()->numerify('########'),
            'is_active' => true,
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'remember_token' => Str::random(10),
        ];
    }

    /**
     * Sans précision, un compte de test est agent immobilier.
     */
    public function configure(): static
    {
        return $this->afterCreating(function (User $user) {
            if ($user->roles()->doesntExist()) {
                $user->assignRole(Role::Agent->value);
            }
        });
    }

    public function withRoles(Role|string ...$roles): static
    {
        return $this->afterCreating(fn (User $user) => $user->syncRoles(
            array_map(fn (Role|string $role) => $role instanceof Role ? $role->value : $role, $roles),
        ));
    }

    /**
     * Compte sans rôle, avec seulement des permissions individuelles.
     */
    public function withPermissions(string ...$permissions): static
    {
        return $this->afterCreating(function (User $user) use ($permissions) {
            $user->syncRoles([]);
            $user->givePermissionTo($permissions);
        });
    }

    public function dirigeant(): static
    {
        return $this->withRoles(Role::Dirigeant);
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['is_active' => false]);
    }

    public function unverified(): static
    {
        return $this->state(fn () => ['email_verified_at' => null]);
    }
}
