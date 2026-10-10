<?php

namespace App\Support;

/**
 * Liens « click to chat » (https://wa.me/…) : gratuits, ouvrent WhatsApp avec un message pré-rempli.
 */
final class WhatsApp
{
    public static function link(?string $phone, string $text = ''): ?string
    {
        $normalized = PhoneNumber::normalize($phone);

        if ($normalized === null) {
            return null;
        }

        $url = 'https://wa.me/'.ltrim($normalized, '+');

        return $text === '' ? $url : $url.'?text='.rawurlencode($text);
    }
}
