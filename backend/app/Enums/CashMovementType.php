<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

/**
 * Mouvements de caisse hors encaissements de factures.
 */
enum CashMovementType: string
{
    use HasOptions;

    case Apport = 'apport';
    case DepotBanque = 'depot_banque';
    case Depense = 'depense';
    case Retrait = 'retrait';
    case RestitutionCaution = 'restitution_caution';
    case AnnulationCaution = 'annulation_caution';

    public function label(): string
    {
        return match ($this) {
            self::Apport => 'Apport (fonds de caisse)',
            self::DepotBanque => 'Dépôt en banque',
            self::Depense => 'Dépense payée en espèces',
            self::Retrait => 'Remise au dirigeant',
            self::RestitutionCaution => 'Restitution de caution',
            self::AnnulationCaution => 'Annulation d\'une restitution de caution',
        };
    }

    /** +1 pour une entrée d'argent dans la caisse, -1 pour une sortie. */
    public function sign(): int
    {
        return in_array($this, [self::Apport, self::AnnulationCaution], true) ? 1 : -1;
    }

    /** Créés automatiquement par la restitution de caution, jamais saisis à la main. */
    public function isAutomatic(): bool
    {
        return in_array($this, [self::RestitutionCaution, self::AnnulationCaution], true);
    }
}
