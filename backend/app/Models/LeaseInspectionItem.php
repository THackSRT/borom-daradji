<?php

namespace App\Models;

use App\Enums\ItemCondition;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Ligne d'un état des lieux : un élément d'une pièce (« Chambre 1 — Murs ») et son état. Pas de
 * journal propre : l'état des lieux est journalisé.
 */
#[Fillable(['room', 'element', 'condition', 'comment', 'position'])]
class LeaseInspectionItem extends Model
{
    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'condition' => ItemCondition::class,
            'position' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<LeaseInspection, $this>
     */
    public function inspection(): BelongsTo
    {
        return $this->belongsTo(LeaseInspection::class, 'lease_inspection_id');
    }

    /**
     * @return HasMany<LeaseInspectionPhoto, $this>
     */
    public function photos(): HasMany
    {
        return $this->hasMany(LeaseInspectionPhoto::class);
    }

    /** Clé de rapprochement entre l'entrée et la sortie. */
    public function key(): string
    {
        return mb_strtolower(trim($this->room)).'|'.mb_strtolower(trim($this->element));
    }
}
