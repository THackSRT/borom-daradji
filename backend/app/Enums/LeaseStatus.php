<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

enum LeaseStatus: string
{
    use HasOptions;

    case Actif = 'actif';
    case Resilie = 'resilie';

    public function label(): string
    {
        return match ($this) {
            self::Actif => 'En cours',
            self::Resilie => 'Résilié',
        };
    }
}
