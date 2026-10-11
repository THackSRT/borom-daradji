<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

/**
 * Activité à laquelle se rattache une facture : sert au chiffre d'affaires par activité (lot 5).
 */
enum Activity: string
{
    use HasOptions;

    case Immobilier = 'immobilier';
    case Location = 'location';
    case Travaux = 'travaux';
    case Negoce = 'negoce';
    case Autre = 'autre';

    public function label(): string
    {
        return match ($this) {
            self::Immobilier => 'Immobilier (vente, commission)',
            self::Location => 'Location et gestion locative',
            self::Travaux => 'Travaux',
            self::Negoce => 'Matériaux',
            self::Autre => 'Autre',
        };
    }
}
