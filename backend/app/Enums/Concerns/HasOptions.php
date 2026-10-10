<?php

namespace App\Enums\Concerns;

/**
 * Pour les enums métier exposant un libellé français via label().
 */
trait HasOptions
{
    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    /**
     * @return array{value: string, label: string}
     */
    public function toOption(): array
    {
        return ['value' => $this->value, 'label' => $this->label()];
    }
}
