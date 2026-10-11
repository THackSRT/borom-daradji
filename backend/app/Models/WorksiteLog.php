<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Entrée du journal de chantier : note de l'équipe, ou trace automatique (statut, avancement).
 * Les entrées publiques apparaissent sur le lien de suivi du client.
 */
#[Fillable(['user_id', 'kind', 'logged_on', 'body', 'is_public'])]
class WorksiteLog extends Model
{
    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return ['logged_on' => 'immutable_date', 'is_public' => 'boolean'];
    }

    /**
     * @return BelongsTo<Worksite, $this>
     */
    public function worksite(): BelongsTo
    {
        return $this->belongsTo(Worksite::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
