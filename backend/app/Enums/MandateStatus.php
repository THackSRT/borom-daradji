<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

enum MandateStatus: string
{
    use HasOptions;

    case Actif = 'actif';
    case Expire = 'expire';
    case Resilie = 'resilie';

    public function label(): string
    {
        return match ($this) {
            self::Actif => 'Actif',
            self::Expire => 'Expiré',
            self::Resilie => 'Résilié',
        };
    }
}
