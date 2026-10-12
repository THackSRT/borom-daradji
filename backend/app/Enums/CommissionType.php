<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

enum CommissionType: string
{
    use HasOptions;

    case Pourcentage = 'pourcentage';
    case Montant = 'montant';

    public function label(): string
    {
        return match ($this) {
            self::Pourcentage => 'Pourcentage du prix',
            self::Montant => 'Montant fixe',
        };
    }
}
