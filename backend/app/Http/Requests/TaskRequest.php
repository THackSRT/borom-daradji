<?php

namespace App\Http\Requests;

use App\Enums\TaskPriority;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class TaskRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->isMethod('post') || $this->user()->can('update', $this->route('task'));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $required = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'title' => [$required, 'string', 'max:255'],
            'details' => ['nullable', 'string', 'max:5000'],
            'due_at' => [$required, 'date'],
            'priority' => ['sometimes', Rule::enum(TaskPriority::class)],
            'user_id' => ['nullable', 'integer', Rule::exists('users', 'id')->where('is_active', true)],
            'client_id' => ['nullable', 'integer', Rule::exists('clients', 'id')],
            'property_id' => ['nullable', 'integer', Rule::exists('properties', 'id')],
            'done' => ['sometimes', 'boolean'],
        ];
    }
}
