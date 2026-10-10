<?php

namespace App\Enums;

/**
 * Rôles internes de l'agence. Un même compte peut en cumuler plusieurs.
 */
enum Role: string
{
    case Dirigeant = 'dirigeant';
    case Agent = 'agent';
    case ResponsableTravaux = 'responsable_travaux';
    case Comptable = 'comptable';
    case Commercial = 'commercial';

    public function label(): string
    {
        return match ($this) {
            self::Dirigeant => 'Dirigeant',
            self::Agent => 'Agent immobilier',
            self::ResponsableTravaux => 'Responsable travaux',
            self::Comptable => 'Comptable',
            self::Commercial => 'Commercial',
        };
    }

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
