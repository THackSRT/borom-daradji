<?php

namespace App\Http\Requests;

use App\Http\Requests\Concerns\ValidatesAccess;
use App\Rules\SenegalPhone;
use App\Support\PhoneNumber;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\Validator;

class StoreUserRequest extends FormRequest
{
    use ValidatesAccess;

    public function authorize(): bool
    {
        return $this->user()->can('users.manage');
    }

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
            ...$this->accessRules('present'),
            'password' => ['required', 'string', Password::min(10)->letters()->numbers()],
        ];
    }

    /**
     * @return array<int, callable>
     */
    public function after(): array
    {
        return [fn (Validator $validator) => $this->validateAccess($validator, null)];
    }
}
