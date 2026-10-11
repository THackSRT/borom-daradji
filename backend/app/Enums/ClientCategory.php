<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

enum ClientCategory: string
{
    use HasOptions;

    case Acheteur = 'acheteur';
    case Locataire = 'locataire';
    case Proprietaire = 'proprietaire';
    case Fournisseur = 'fournisseur';
    case SousTraitant = 'sous_traitant';
    case ClientTravaux = 'client_travaux';

    public function label(): string
    {
        return match ($this) {
            self::Acheteur => 'Acheteur',
            self::Locataire => 'Locataire',
            self::Proprietaire => 'Propriétaire',
            self::Fournisseur => 'Fournisseur',
            self::SousTraitant => 'Sous-traitant',
            self::ClientTravaux => 'Client travaux',
        };
    }
}
