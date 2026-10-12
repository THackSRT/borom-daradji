<?php

namespace App\Http\Requests;

use App\Models\Role;
use App\Support\PermissionCatalog;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('roles.manage');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var Role|null $role */
        $role = $this->route('role');
        $required = $role ? 'sometimes' : 'required';

        return [
            'label' => [$required, 'string', 'max:60', Rule::unique('roles', 'label')->ignore($role)],
            'description' => ['nullable', 'string', 'max:500'],
            'permissions' => [$required, 'array'],
            'permissions.*' => ['distinct', Rule::in(PermissionCatalog::names())],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return ['label' => 'nom du rôle', 'permissions.*' => 'permission'];
    }
}
