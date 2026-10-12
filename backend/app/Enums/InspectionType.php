<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

enum InspectionType: string
{
    use HasOptions;

    case Entree = 'entree';
    case Sortie = 'sortie';

    public function label(): string
    {
        return match ($this) {
            self::Entree => 'État des lieux d\'entrée',
            self::Sortie => 'État des lieux de sortie',
        };
    }
}
