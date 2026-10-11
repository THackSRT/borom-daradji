<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

enum PropertyStatus: string
{
    use HasOptions;

    case Brouillon = 'brouillon';
    case Disponible = 'disponible';
    case EnNegociation = 'en_negociation';
    case SousPromesse = 'sous_promesse';
    case Vendu = 'vendu';
    case Loue = 'loue';
    case Retire = 'retire';

    public function label(): string
    {
        return match ($this) {
            self::Brouillon => 'Brouillon',
            self::Disponible => 'Disponible',
            self::EnNegociation => 'En négociation',
            self::SousPromesse => 'Promesse signée',
            self::Vendu => 'Vendu',
            self::Loue => 'Loué',
            self::Retire => 'Retiré',
        };
    }

    /**
     * Transitions autorisées. « Retiré » est possible depuis tout statut ; un bien retiré,
     * vendu ou loué peut être remis en vente (retour à « disponible », vérification refaite).
     *
     * @return list<self>
     */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Brouillon => [self::Disponible, self::Retire],
            self::Disponible => [self::EnNegociation, self::SousPromesse, self::Vendu, self::Loue, self::Retire],
            self::EnNegociation => [self::Disponible, self::SousPromesse, self::Vendu, self::Loue, self::Retire],
            self::SousPromesse => [self::Disponible, self::Vendu, self::Loue, self::Retire],
            self::Vendu, self::Loue, self::Retire => [self::Disponible],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    /**
     * Statuts visibles sur le site vitrine.
     *
     * @return list<self>
     */
    public static function public(): array
    {
        return [self::Disponible, self::EnNegociation];
    }

    public function isPublic(): bool
    {
        return in_array($this, self::public(), true);
    }
}
