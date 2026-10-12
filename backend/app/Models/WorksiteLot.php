<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Lot d'un chantier, repris d'un lot du devis : montant HT (base des situations) et avancement en %.
 */
#[Fillable(['quote_lot_id', 'trade_id', 'title', 'amount_ht', 'progress', 'position'])]
class WorksiteLot extends Model
{
    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return ['amount_ht' => 'integer', 'progress' => 'integer', 'position' => 'integer'];
    }

    /**
     * @return BelongsTo<Worksite, $this>
     */
    public function worksite(): BelongsTo
    {
        return $this->belongsTo(Worksite::class);
    }

    /**
     * @return BelongsTo<Trade, $this>
     */
    public function trade(): BelongsTo
    {
        return $this->belongsTo(Trade::class);
    }
}
