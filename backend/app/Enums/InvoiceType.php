<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

enum InvoiceType: string
{
    use HasOptions;

    case Facture = 'facture';
    case Avoir = 'avoir';

    public function label(): string
    {
        return match ($this) {
            self::Facture => 'Facture',
            self::Avoir => 'Avoir',
        };
    }

    /** Préfixe du numéro : FAC-2026-00001, AV-2026-00001. */
    public function prefix(): string
    {
        return match ($this) {
            self::Facture => 'FAC',
            self::Avoir => 'AV',
        };
    }
}
