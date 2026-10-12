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
            'France avec +' => ['+33 6 12 34 56 78', '+33612345678'],
            'France avec 00' => ['0033 6 12 34 56 78', '+33612345678'],
            'Canada' => ['+1 (514) 555-0199', '+15145550199'],
            'numéro français sans indicatif' => ['06 12 34 56 78', null],
            'indicatif seul' => ['+33 12', null],
            '+221 avec préfixe inconnu' => ['+221 55 123 45 67', null],
            'vide' => ['', null],
            'null' => [null, null],
        ];
    }

    #[DataProvider('inputs')]
    public function test_normalize(?string $input, ?string $expected): void
    {
        $this->assertSame($expected, PhoneNumber::normalize($input));
    }

    public function test_format_for_display(): void
    {
        $this->assertSame('77 123 45 67', PhoneNumber::format('+221771234567'));
        $this->assertSame('+33612345678', PhoneNumber::format('+33612345678'));
        $this->assertSame('', PhoneNumber::format(null));
    }
}
