<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

enum VisitStatus: string
{
    use HasOptions;

    case Planifiee = 'planifiee';
    case Effectuee = 'effectuee';
    case Annulee = 'annulee';
    case Absent = 'absent';

    public function label(): string
    {
        return match ($this) {
            self::Planifiee => 'Planifiée',
            self::Effectuee => 'Effectuée',
            self::Annulee => 'Annulée',
            self::Absent => 'Prospect absent',
        };
    }
}
