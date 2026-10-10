<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

/**
 * Étape du prospect, choisie par l'agent (pas de score automatique, voir D-016).
 */
enum PipelineStatus: string
{
    use HasOptions;

    case Nouveau = 'nouveau';
    case Contacte = 'contacte';
    case Visite = 'visite';
    case Negociation = 'negociation';
    case Gagne = 'gagne';
    case Perdu = 'perdu';

    public function label(): string
    {
        return match ($this) {
            self::Nouveau => 'Nouveau',
            self::Contacte => 'Contacté',
            self::Visite => 'Visite faite',
            self::Negociation => 'En négociation',
            self::Gagne => 'Gagné',
            self::Perdu => 'Perdu',
        };
    }

    /**
     * Ordre d'avancement, pour ne jamais faire reculer un prospect automatiquement.
     */
    public function rank(): int
    {
        return match ($this) {
            self::Nouveau => 0,
            self::Contacte => 1,
            self::Visite => 2,
            self::Negociation => 3,
            self::Gagne, self::Perdu => 4,
        };
    }
}
