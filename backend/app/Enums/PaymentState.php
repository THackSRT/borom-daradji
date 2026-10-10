<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

/**
 * État de règlement d'une facture émise, calculé à partir des encaissements et des avoirs.
 */
enum PaymentState: string
{
    use HasOptions;

    case NonPayee = 'non_payee';
    case Partielle = 'partielle';
    case Payee = 'payee';
    case Annulee = 'annulee';

    public function label(): string
    {
        return match ($this) {
            self::NonPayee => 'À payer',
            self::Partielle => 'Payée en partie',
            self::Payee => 'Payée',
            self::Annulee => 'Annulée par avoir',
        };
    }
}
