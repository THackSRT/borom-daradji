<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

enum WorksiteStatus: string
{
    use HasOptions;

    case Devis = 'devis';
    case Planifie = 'planifie';
    case EnCours = 'en_cours';
    case Suspendu = 'suspendu';
    case Termine = 'termine';
    case Facture = 'facture';

    public function label(): string
    {
        return match ($this) {
            self::Devis => 'Devis en cours',
            self::Planifie => 'Planifié',
            self::EnCours => 'En cours',
            self::Suspendu => 'Suspendu',
            self::Termine => 'Terminé',
            self::Facture => 'Facturé',
        };
    }

    /**
     * @return list<self>
     */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Devis => [self::Planifie],
            self::Planifie => [self::EnCours, self::Suspendu],
            self::EnCours => [self::Suspendu, self::Termine],
            self::Suspendu => [self::EnCours, self::Planifie],
            self::Termine => [self::EnCours, self::Facture],
            self::Facture => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    /** Chantier ouvert : on y pointe, on y dépense, on y avance. */
    public function isOpen(): bool
    {
        return in_array($this, [self::Planifie, self::EnCours, self::Suspendu], true);
    }
}
