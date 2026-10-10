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

    public function label(): string
    {
        return match ($this) {
            self::Apport => 'Apport (fonds de caisse)',
            self::DepotBanque => 'Dépôt en banque',
            self::Depense => 'Dépense payée en espèces',
            self::Retrait => 'Remise au dirigeant',
        };
    }

    /** +1 pour une entrée d'argent dans la caisse, -1 pour une sortie. */
    public function sign(): int
    {
        return $this === self::Apport ? 1 : -1;
    }
}
