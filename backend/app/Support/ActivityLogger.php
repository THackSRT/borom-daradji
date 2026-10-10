<?php

namespace App\Support;

use App\Models\ActivityLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * Journal d'activité : qui a fait quoi, sur quoi, quand, avec les valeurs avant/après.
 */
final class ActivityLogger
{
    /**
     * @param  array<string, array{old: mixed, new: mixed}>|null  $changes
     */
    public static function log(
        string $action,
        ?Model $subject = null,
        ?string $description = null,
        ?array $changes = null,
        ?User $user = null,
    ): ActivityLog {
        $request = app()->runningInConsole() ? null : request();
        $actor = $user ?? auth()->user();

        return ActivityLog::create([
            'user_id' => $actor instanceof User ? $actor->getKey() : null,
            'action' => $action,
            'subject_type' => $subject?->getMorphClass(),
            'subject_id' => $subject?->getKey(),
            'description' => $description,
            'changes' => $changes ?: null,
            'ip_address' => $request?->ip(),
            'user_agent' => $request ? Str::limit((string) $request->userAgent(), 250, '') : null,
        ]);
    }
}
