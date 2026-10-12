<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

enum TaskPriority: string
{
    use HasOptions;

    case Basse = 'basse';
    case Normale = 'normale';
    case Haute = 'haute';

    public function label(): string
    {
        return match ($this) {
            self::Basse => 'Basse',
            self::Normale => 'Normale',
            self::Haute => 'Haute',
        };
    }
}
