<?php

namespace App\Models\Concerns;

use App\Support\ActivityLogger;
use Illuminate\Database\Eloquent\Model;

/**
 * Trace automatiquement les créations, modifications et suppressions d'un modèle.
 * Les attributs masqués (mot de passe…) ne sont jamais copiés : on note seulement qu'ils ont changé.
 */
trait LogsActivity
{
    public static function bootLogsActivity(): void
    {
        static::created(function (Model $model) {
            $changes = [];
            foreach (static::loggableAttributes($model, $model->getAttributes()) as $key => $value) {
                $changes[$key] = ['old' => null, 'new' => $value];
            }
            ActivityLogger::log('created', $model, changes: $changes);
        });

        static::updated(function (Model $model) {
            $changes = [];
            foreach (array_keys($model->getChanges()) as $key) {
                if (in_array($key, ['updated_at', 'created_at'], true)) {
                    continue;
                }
                if (in_array($key, $model->getHidden(), true)) {
                    $changes[$key] = ['old' => null, 'new' => '(modifié)'];

                    continue;
                }
                $changes[$key] = ['old' => $model->getRawOriginal($key), 'new' => $model->getAttributes()[$key]];
            }

            if ($changes !== []) {
                ActivityLogger::log('updated', $model, changes: $changes);
            }
        });

        static::deleted(function (Model $model) {
            ActivityLogger::log('deleted', $model);
        });
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @return array<string, mixed>
     */
    protected static function loggableAttributes(Model $model, array $attributes): array
    {
        return array_diff_key(
            $attributes,
            array_flip([...$model->getHidden(), 'id', 'created_at', 'updated_at']),
        );
    }
}
