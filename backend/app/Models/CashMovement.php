<?php

namespace App\Models;

use App\Enums\CashMovementType;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Entrée ou sortie d'espèces sans facture : fonds de caisse, dépôt en banque, petite dépense…
 */
#[Fillable(['type', 'amount', 'label', 'created_by'])]
class CashMovement extends Model
{
    use LogsActivity;

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'type' => CashMovementType::class,
            'amount' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<CashSession, $this>
     */
    public function session(): BelongsTo
    {
        return $this->belongsTo(CashSession::class, 'cash_session_id');
    }
}
