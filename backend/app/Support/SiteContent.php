<?php

namespace App\Support;

use App\Models\CompanySetting;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Storage;

/**
 * Contenu du site vitrine : valeurs par défaut (config/site.php) + modifications du dirigeant.
 */
final class SiteContent
{
    public const SECTIONS = ['identity', 'seo', 'contact', 'social', 'footer', 'legal', 'home', 'works'];

    public const ICONS = [
        'home', 'building', 'hammer', 'package', 'paintbrush', 'wrench', 'zap', 'droplets', 'wind', 'tree',
        'users', 'award', 'check', 'key', 'shield', 'truck', 'phone', 'star',
    ];

    /**
     * @return array<string, mixed>
     */
    public static function defaults(): array
    {
        return config('site');
    }

    /**
     * Contenu complet : chaque champ modifié remplace la valeur par défaut ; une liste modifiée
     * (services, chiffres…) remplace la liste entière.
     *
     * @return array<string, mixed>
     */
    public static function for(CompanySetting $settings): array
    {
        return self::merge(self::defaults(), $settings->site ?? []);
    }

    /**
     * Même contenu, avec les chemins d'images transformés en URL affichables.
     *
     * @return array<string, mixed>
     */
    public static function public(CompanySetting $settings): array
    {
        return self::resolveImages(self::for($settings));
    }

    /**
     * Enregistre une section : seules les valeurs différentes du défaut sont gardées, et les images
     * envoyées qui ne servent plus sont supprimées du disque.
     *
     * @param  array<string, mixed>  $values  champs validés de la section
     */
    public static function saveSection(CompanySetting $settings, string $section, array $values): void
    {
        $defaults = self::defaults()[$section];
        $overrides = $settings->site ?? [];
        $before = self::imagePaths($overrides);

        $current = array_merge($defaults, $overrides[$section] ?? []);
        foreach ($values as $key => $value) {
            if (array_key_exists($key, $defaults)) {
                $current[$key] = self::normalize($value, $defaults[$key]);
            }
        }

        $changed = array_filter(
            array_intersect_key($current, $defaults),
            fn (mixed $value, string $key) => $value !== $defaults[$key],
            ARRAY_FILTER_USE_BOTH,
        );

        if ($changed) {
            $overrides[$section] = $changed;
        } else {
            unset($overrides[$section]);
        }

        self::store($settings, $overrides, $before);
    }

    /**
     * Revient au contenu par défaut d'une section.
     */
    public static function resetSection(CompanySetting $settings, string $section): void
    {
        $overrides = $settings->site ?? [];
        $before = self::imagePaths($overrides);
        unset($overrides[$section]);

        self::store($settings, $overrides, $before);
    }

    /**
     * Chemins (disque public) de toutes les images envoyées, avec leur URL : pour l'aperçu du back-office.
     *
     * @param  array<string, mixed>  $content
     * @return array<string, string>
     */
    public static function imageUrls(array $content): array
    {
        return collect(self::imagePaths($content))->mapWithKeys(fn (string $path) => [$path => self::url($path)])->all();
    }

    /**
     * @param  array<string, mixed>  $content
     * @return list<string>
     */
    public static function imagePaths(array $content): array
    {
        $paths = [];
        array_walk_recursive($content, function (mixed $value, int|string $key) use (&$paths) {
            if (is_string($key) && str_ends_with($key, '_image') && is_string($value) && str_starts_with($value, 'site/')) {
                $paths[] = $value;
            }
        });

        return array_values(array_unique($paths));
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @param  list<string>  $before
     */
    private static function store(CompanySetting $settings, array $overrides, array $before): void
    {
        $settings->site = $overrides ?: null;
        $settings->save();

        $unused = array_diff($before, self::imagePaths($overrides));
        if ($unused) {
            Storage::disk('public')->delete(array_values($unused));
        }
    }

    /**
     * Ramène une valeur saisie au type de la valeur par défaut (case à cocher, texte vidé…).
     */
    private static function normalize(mixed $value, mixed $default): mixed
    {
        if (is_bool($default)) {
            return (bool) $value;
        }

        if ($value === null && is_string($default)) {
            return '';
        }

        return $value;
    }

    /**
     * @param  array<string, mixed>  $base
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    public static function merge(array $base, array $overrides): array
    {
        foreach ($overrides as $key => $value) {
            $base[$key] = is_array($value) && Arr::isAssoc($value) && isset($base[$key]) && is_array($base[$key]) && Arr::isAssoc($base[$key])
                ? self::merge($base[$key], $value)
                : $value;
        }

        return $base;
    }

    /**
     * @param  array<string, mixed>  $content
     * @return array<string, mixed>
     */
    public static function resolveImages(array $content): array
    {
        foreach ($content as $key => $value) {
            if (is_array($value)) {
                $content[$key] = self::resolveImages($value);
            } elseif (is_string($key) && str_ends_with($key, '_image')) {
                $content[$key] = self::url($value);
            }
        }

        return $content;
    }

    public static function url(?string $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        return str_starts_with($value, 'http') ? $value : Storage::disk('public')->url($value);
    }
}
