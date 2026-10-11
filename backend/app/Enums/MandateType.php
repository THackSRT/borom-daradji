<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

enum MandateType: string
{
    use HasOptions;

    case Exclusif = 'exclusif';
    case Simple = 'simple';
    case Recherche = 'recherche';

    public function label(): string
    {
        return match ($this) {
            self::Exclusif => 'Exclusif',
            self::Simple => 'Simple',
            self::Recherche => 'De recherche',
        };
    }
}
