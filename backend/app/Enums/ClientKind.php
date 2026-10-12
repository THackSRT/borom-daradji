<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

enum ClientKind: string
{
    use HasOptions;

    case Particulier = 'particulier';
    case Entreprise = 'entreprise';

    public function label(): string
    {
        return match ($this) {
            self::Particulier => 'Particulier',
            self::Entreprise => 'Entreprise',
        };
    }
}
