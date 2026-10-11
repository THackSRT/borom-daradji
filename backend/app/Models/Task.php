<?php

namespace App\Models;

use App\Enums\TaskPriority;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Rappel ou chose à faire pour un utilisateur (« Rappeler M. Diop », « Proposer BD-2026-0004 à Awa »).
 */
#[Fillable(['user_id', 'created_by', 'client_id', 'property_id', 'title', 'details', 'due_at', 'priority', 'done_at'])]
class Task extends Model
{
    use LogsActivity;

    protected $attributes = [
        'priority' => 'normale',
    ];

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'priority' => TaskPriority::class,
            'due_at' => 'datetime',
            'done_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<Client, $this>
     */
    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }

    /**
     * @return BelongsTo<Property, $this>
     */
    public function property(): BelongsTo
    {
        return $this->belongsTo(Property::class);
    }

    /**
     * @param  Builder<Task>  $query
     */
    public function scopeOpen(Builder $query): void
    {
        $query->whereNull('done_at');
    }
}
