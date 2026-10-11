<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

/**
 * Situation juridique du bien (ou du terrain sur lequel il est bâti).
 */
enum LandStatus: string
{
    use HasOptions;

    case TitreFoncier = 'titre_foncier';
    case Bail = 'bail';
    case Deliberation = 'deliberation';
    case ActeAdministratif = 'acte_administratif';
    case Autre = 'autre';
    case Inconnu = 'inconnu';

    public function label(): string
    {
        return match ($this) {
            self::TitreFoncier => 'Titre foncier',
            self::Bail => 'Bail',
            self::Deliberation => 'Délibération',
            self::ActeAdministratif => 'Acte administratif',
            self::Autre => 'Autre',
            self::Inconnu => 'Inconnu',
        };
    }
}
