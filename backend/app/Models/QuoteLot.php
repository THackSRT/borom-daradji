<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Lot d'un devis (ex. « Plomberie — salle de bain »). Pas de journal propre : le devis est journalisé.
 */
#[Fillable(['trade_id', 'title', 'position', 'total_ht'])]
class QuoteLot extends Model
{
    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return ['position' => 'integer', 'total_ht' => 'integer'];
    }

    /**
     * @return BelongsTo<Quote, $this>
     */
    public function quote(): BelongsTo
    {
        return $this->belongsTo(Quote::class);
    }

    /**
     * @return BelongsTo<Trade, $this>
     */
    public function trade(): BelongsTo
    {
        return $this->belongsTo(Trade::class);
    }

    /**
     * @return HasMany<QuoteLine, $this>
     */
    public function lines(): HasMany
    {
        return $this->hasMany(QuoteLine::class)->orderBy('position')->orderBy('id');
    }
}
