<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

/**
 * Points de la vérification foncière exigés avant de publier un bien.
 * Liste par défaut, à valider avec le dirigeant (voir docs/journal.md).
 */
enum PropertyCheckItem: string
{
    use HasOptions;

    case IdentiteProprietaire = 'identite_proprietaire';
    case JustificatifDroit = 'justificatif_droit';
    case EtatDroitsReels = 'etat_droits_reels';
    case PlanBornage = 'plan_bornage';
    case AbsenceLitige = 'absence_litige';
    case MandatSigne = 'mandat_signe';

    public function label(): string
    {
        return match ($this) {
            self::IdentiteProprietaire => 'Identité du propriétaire vérifiée',
            self::JustificatifDroit => 'Pièce justifiant le droit (titre foncier, bail, délibération…)',
            self::EtatDroitsReels => 'État des droits réels récent',
            self::PlanBornage => 'Plan ou procès-verbal de bornage',
            self::AbsenceLitige => 'Absence de litige connu',
            self::MandatSigne => 'Mandat signé',
        };
    }
}
