<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

enum CheckStatus: string
{
    use HasOptions;

    case AFaire = 'a_faire';
    case Ok = 'ok';
    case Ko = 'ko';
    case SansObjet = 'sans_objet';

    public function label(): string
    {
        return match ($this) {
            self::AFaire => 'À faire',
            self::Ok => 'Vérifié',
            self::Ko => 'Problème',
            self::SansObjet => 'Sans objet',
        };
    }

    public function isCleared(): bool
    {
        return $this === self::Ok || $this === self::SansObjet;
    }
}
