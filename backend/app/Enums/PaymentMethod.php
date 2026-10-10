<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

enum PaymentMethod: string
{
    use HasOptions;

    case Especes = 'especes';
    case Wave = 'wave';
    case OrangeMoney = 'orange_money';
    case FreeMoney = 'free_money';
    case Cheque = 'cheque';
    case Virement = 'virement';

    public function label(): string
    {
        return match ($this) {
            self::Especes => 'Espèces',
            self::Wave => 'Wave',
            self::OrangeMoney => 'Orange Money',
            self::FreeMoney => 'Free Money / Mixx',
            self::Cheque => 'Chèque',
            self::Virement => 'Virement',
        };
    }

    /**
     * Référence obligatoire (identifiant de transaction, numéro de chèque…) pour tout sauf les espèces :
     * c'est ce qui permet le rapprochement avec les relevés.
     */
    public function requiresReference(): bool
    {
        return $this !== self::Especes;
    }
}
