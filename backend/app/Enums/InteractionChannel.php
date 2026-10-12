<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

enum InteractionChannel: string
{
    use HasOptions;

    case Appel = 'appel';
    case Whatsapp = 'whatsapp';
    case Sms = 'sms';
    case Email = 'email';
    case Visite = 'visite';
    case Rencontre = 'rencontre';
    case FormulaireSite = 'formulaire_site';

    public function label(): string
    {
        return match ($this) {
            self::Appel => 'Appel',
            self::Whatsapp => 'WhatsApp',
            self::Sms => 'SMS',
            self::Email => 'Email',
            self::Visite => 'Visite',
            self::Rencontre => 'Rencontre',
            self::FormulaireSite => 'Formulaire du site',
        };
    }
}
