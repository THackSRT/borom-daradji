<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

enum PropertyType: string
{
    use HasOptions;

    case Terrain = 'terrain';
    case Maison = 'maison';
    case Appartement = 'appartement';
    case Villa = 'villa';
    case Local = 'local';
    case Immeuble = 'immeuble';

    public function label(): string
    {
        return match ($this) {
            self::Terrain => 'Terrain',
            self::Maison => 'Maison',
            self::Appartement => 'Appartement',
            self::Villa => 'Villa',
            self::Local => 'Local commercial',
            self::Immeuble => 'Immeuble',
        };
    }
}
