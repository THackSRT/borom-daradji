<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

enum PropertyDocumentType: string
{
    use HasOptions;

    case TitreFoncier = 'titre_foncier';
    case EtatDroitsReels = 'etat_droits_reels';
    case PlanCadastral = 'plan_cadastral';
    case Mandat = 'mandat';
    case ContratLocation = 'contrat_location';
    case PieceProprietaire = 'piece_proprietaire';
    case Autre = 'autre';

    public function label(): string
    {
        return match ($this) {
            self::TitreFoncier => 'Titre foncier, bail ou délibération',
            self::EtatDroitsReels => 'État des droits réels',
            self::PlanCadastral => 'Plan cadastral ou de bornage',
            self::Mandat => 'Mandat',
            self::ContratLocation => 'Contrat de location',
            self::PieceProprietaire => 'Pièce du propriétaire',
            self::Autre => 'Autre',
        };
    }
}
