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
    // Loyer impayé retenu sur la caution en fin de bail (App\Services\DepositService), jamais saisi à la main.
    case Caution = 'caution';

    public function label(): string
    {
        return match ($this) {
            self::Especes => 'Espèces',
            self::Wave => 'Wave',
            self::OrangeMoney => 'Orange Money',
            self::FreeMoney => 'Free Money / Mixx',
            self::Cheque => 'Chèque',
            self::Virement => 'Virement',
            self::Caution => 'Retenue sur caution',
        };
    }

    /**
     * Référence obligatoire (identifiant de transaction, numéro de chèque…) pour tout sauf les espèces :
     * c'est ce qui permet le rapprochement avec les relevés.
     */
    public function requiresReference(): bool
    {
        return ! in_array($this, [self::Especes, self::Caution], true);
    }

    /**
     * Modes proposés pour encaisser ou rembourser (la retenue sur caution est automatique).
     *
     * @return list<self>
     */
    public static function manual(): array
    {
        return array_values(array_filter(self::cases(), fn (self $m) => $m !== self::Caution));
    }
}
