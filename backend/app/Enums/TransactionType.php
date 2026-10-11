<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

enum TransactionType: string
{
    use HasOptions;

    case Vente = 'vente';
    case Location = 'location';

    public function label(): string
    {
        return match ($this) {
            self::Vente => 'Vente',
            self::Location => 'Location',
        };
    }
}
