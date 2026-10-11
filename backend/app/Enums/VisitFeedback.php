<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

enum VisitFeedback: string
{
    use HasOptions;

    case Interesse = 'interesse';
    case PasInteresse = 'pas_interesse';
    case ARevoir = 'a_revoir';

    public function label(): string
    {
        return match ($this) {
            self::Interesse => 'Intéressé',
            self::PasInteresse => 'Pas intéressé',
            self::ARevoir => 'À revoir',
        };
    }
}
