<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

enum LeadSource: string
{
    use HasOptions;

    case Site = 'site';
    case Whatsapp = 'whatsapp';
    case Appel = 'appel';
    case Recommandation = 'recommandation';
    case Agence = 'agence';
    case ReseauxSociaux = 'reseaux_sociaux';
    case Autre = 'autre';

    public function label(): string
    {
        return match ($this) {
            self::Site => 'Site internet',
            self::Whatsapp => 'WhatsApp',
            self::Appel => 'Appel',
            self::Recommandation => 'Recommandation',
            self::Agence => 'Passage à l\'agence',
            self::ReseauxSociaux => 'Réseaux sociaux',
            self::Autre => 'Autre',
        };
    }
}
