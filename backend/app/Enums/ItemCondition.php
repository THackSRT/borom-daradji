<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

/**
 * État d'un élément lors d'un état des lieux, du meilleur au pire.
 */
enum ItemCondition: string
{
    use HasOptions;

    case Neuf = 'neuf';
    case Bon = 'bon';
    case Usage = 'usage';
    case Mauvais = 'mauvais';
    case HorsService = 'hors_service';

    public function label(): string
    {
        return match ($this) {
            self::Neuf => 'Neuf',
            self::Bon => 'Bon état',
            self::Usage => 'Usure normale',
            self::Mauvais => 'Dégradé',
            self::HorsService => 'Hors service ou manquant',
        };
    }

    public function rank(): int
    {
        return array_search($this, self::cases(), true);
    }

    /**
     * Dégradation imputable au locataire : pire qu'à l'entrée et au-delà de l'usure normale
     * (l'usure due à l'usage normal du logement ne se retient pas sur la caution).
     */
    public function isDegradationFrom(?self $entry): bool
    {
        return $this->rank() > self::Usage->rank() && ($entry === null || $this->rank() > $entry->rank());
    }
}
