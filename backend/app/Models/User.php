<?php

namespace App\Models;

use App\Enums\Role;
use App\Models\Concerns\LogsActivity;
use App\Support\PermissionCatalog;
use App\Support\PhoneNumber;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

#[Fillable(['name', 'email', 'phone', 'is_active', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasRoles, LogsActivity, Notifiable;

    /** Garde des rôles et permissions (les jetons Sanctum s'authentifient sur le même fournisseur). */
    protected string $guard_name = 'web';

    protected $attributes = [
        'is_active' => true,
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    protected function phone(): Attribute
    {
        return Attribute::make(
            set: fn (?string $value) => PhoneNumber::normalize($value) ?? $value,
        );
    }

    /**
     * Le dirigeant est super-administrateur : toutes les permissions, y compris les futures.
     */
    public function isSuperAdmin(): bool
    {
        return $this->hasRole(PermissionCatalog::SUPER_ADMIN);
    }

    public function isDirigeant(): bool
    {
        return $this->isSuperAdmin();
    }

    /**
     * Vrai si le compte a au moins une des permissions (par ses rôles ou à titre individuel).
     * À utiliser dans les policies ; ailleurs, `can()` passe aussi par les policies.
     */
    public function hasPermission(string ...$permissions): bool
    {
        if ($this->isSuperAdmin()) {
            return true;
        }

        foreach ($permissions as $permission) {
            if ($this->checkPermissionTo($permission)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Permissions effectives (rôles + individuelles), triées.
     *
     * @return list<string>
     */
    public function effectivePermissions(): array
    {
        if ($this->isSuperAdmin()) {
            return PermissionCatalog::names();
        }

        return $this->getAllPermissions()->pluck('name')->unique()->sort()->values()->all();
    }

    /**
     * @param  Builder<User>  $query
     */
    public function scopeActive(Builder $query): void
    {
        $query->where('is_active', true);
    }

    /**
     * @param  Builder<User>  $query
     */
    public function scopeWithRole(Builder $query, Role|string $role): void
    {
        $query->role($role instanceof Role ? $role->value : $role);
    }
}
