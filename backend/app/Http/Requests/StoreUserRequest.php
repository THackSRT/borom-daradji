<?php

namespace App\Http\Requests;

use App\Enums\Role;
use App\Rules\SenegalPhone;
use App\Support\PhoneNumber;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class StoreUserRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge([
            'email' => $this->has('email') ? Str::lower(trim((string) $this->input('email'))) : null,
            'phone' => $this->filled('phone') ? (PhoneNumber::normalize($this->input('phone')) ?? $this->input('phone')) : null,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['nullable', new SenegalPhone, 'unique:users,phone'],
            'roles' => ['required', 'array', 'min:1'],
            'roles.*' => ['distinct', Rule::enum(Role::class)],
            'password' => ['required', 'string', Password::min(10)->letters()->numbers()],
        ];
    }
}
