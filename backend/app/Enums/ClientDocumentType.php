<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

enum ClientDocumentType: string
{
    use HasOptions;

    case Cni = 'cni';
    case Passeport = 'passeport';
    case Justificatif = 'justificatif';
    case Autre = 'autre';

    public function label(): string
    {
        return match ($this) {
            self::Cni => 'Carte d\'identité',
            self::Passeport => 'Passeport',
            self::Justificatif => 'Justificatif',
            self::Autre => 'Autre',
        };
    }

    public function isIdentity(): bool
    {
        return $this === self::Cni || $this === self::Passeport;
    }
}
