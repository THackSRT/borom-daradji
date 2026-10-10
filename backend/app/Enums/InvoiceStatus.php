<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

/**
 * Une facture émise ne se modifie ni ne se supprime : on la corrige par un avoir.
 */
enum InvoiceStatus: string
{
    use HasOptions;

    case Brouillon = 'brouillon';
    case Emise = 'emise';

    public function label(): string
    {
        return match ($this) {
            self::Brouillon => 'Brouillon',
            self::Emise => 'Émise',
        };
    }
}
