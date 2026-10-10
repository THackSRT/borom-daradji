<?php

namespace App\Http\Requests;

use App\Enums\Role;
use App\Models\User;
use App\Rules\SenegalPhone;
use App\Support\PhoneNumber;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\Validator;

class UpdateUserRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        if ($this->has('email')) {
            $this->merge(['email' => Str::lower(trim((string) $this->input('email')))]);
        }

        if ($this->filled('phone')) {
            $this->merge(['phone' => PhoneNumber::normalize($this->input('phone')) ?? $this->input('phone')]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        /** @var User $user */
        $user = $this->route('user');

        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => ['sometimes', 'required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user)],
            'phone' => ['sometimes', 'nullable', new SenegalPhone, Rule::unique('users', 'phone')->ignore($user)],
            'roles' => ['sometimes', 'required', 'array', 'min:1'],
            'roles.*' => ['distinct', Rule::enum(Role::class)],
            'is_active' => ['sometimes', 'boolean'],
            'password' => ['sometimes', 'required', 'string', Password::min(10)->letters()->numbers()],
        ];
    }

    /**
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                /** @var User $user */
                $user = $this->route('user');

                if (! $user->is($this->user())) {
                    return;
                }

                // Le dirigeant connecté ne peut pas s'enlever l'accès : il reste toujours un dirigeant actif.
                if ($this->has('is_active') && ! $this->boolean('is_active')) {
                    $validator->errors()->add('is_active', 'Vous ne pouvez pas désactiver votre propre compte.');
                }

                if ($this->has('roles') && ! in_array(Role::Dirigeant->value, (array) $this->input('roles'), true)) {
                    $validator->errors()->add('roles', 'Vous ne pouvez pas retirer votre propre rôle de dirigeant.');
                }
            },
        ];
    }
}
