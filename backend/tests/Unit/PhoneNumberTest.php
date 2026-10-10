<?php

namespace Tests\Unit;

use App\Support\PhoneNumber;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class PhoneNumberTest extends TestCase
{
    /**
     * @return array<string, array{string|null, string|null}>
     */
    public static function inputs(): array
    {
        return [
            'mobile avec espaces' => ['77 123 45 67', '+221771234567'],
            'mobile collé' => ['781234567', '+221781234567'],
            'indicatif +221' => ['+221 70 123 45 67', '+221701234567'],
            'indicatif 00221' => ['00221 76 123 45 67', '+221761234567'],
            'indicatif sans +' => ['221771234567', '+221771234567'],
            'fixe Dakar' => ['33 867 89 00', '+221338678900'],
            'points et tirets' => ['77.123-45-67', '+221771234567'],
            'trop court' => ['77 123 45', null],
            'préfixe inconnu' => ['55 123 45 67', null],
            'numéro étranger' => ['+33 6 12 34 56 78', null],
            'vide' => ['', null],
            'null' => [null, null],
        ];
    }

    #[DataProvider('inputs')]
    public function test_normalize(?string $input, ?string $expected): void
    {
        $this->assertSame($expected, PhoneNumber::normalize($input));
    }
}
