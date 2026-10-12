<?php

namespace App\Models;

use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Mouvement de la caisse d'un chantier, tenue par le chef de chantier : approvisionnement (argent reçu
 * de l'agence), dépense sur place (avec photo du reçu), paiement d'un tâcheron, retour à l'agence.
 * Jamais supprimé : annulé avec un motif.
 */
#[Fillable(['worksite_id', 'kind', 'category', 'amount', 'label', 'spent_on', 'receipt_path', 'holder_id', 'cash_movement_id', 'client_uuid', 'created_by'])]
class SiteCashEntry extends Model
{
    use LogsActivity;

    public const KINDS = [
        'approvisionnement' => ['Approvisionnement', 1],
        'depense' => ['Dépense', -1],
        'paiement_tacheron' => ['Paiement d\'un tâcheron', -1],
        'retour' => ['Retour à l\'agence', -1],
    ];

    public const CATEGORIES = [
        'materiaux' => 'Matériaux',
        'main_oeuvre' => 'Main-d\'œuvre ponctuelle',
        'transport' => 'Transport et livraison',
        'outillage' => 'Outillage et location',
        'divers' => 'Divers',
    ];

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return ['amount' => 'integer', 'spent_on' => 'immutable_date', 'cancelled_at' => 'datetime'];
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
    public function holder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'holder_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function sign(): int
    {
        return self::KINDS[$this->kind][1];
    }

    public function isCancelled(): bool
    {
        return $this->cancelled_at !== null;
    }

    /**
     * @param  Builder<SiteCashEntry>  $query
     */
    public function scopeValid(Builder $query): void
    {
        $query->whereNull('cancelled_at');
    }
}
