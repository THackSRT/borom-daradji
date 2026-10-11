<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Redimensionne et convertit les photos en WebP : des pages légères pour une connexion 3G/4G.
 */
final class ImageOptimizer
{
    public const MAX_WIDTH = 1600;

    public const QUALITY = 80;

    public static function storeAsWebp(UploadedFile $file, string $directory, string $disk = 'public'): string
    {
        $source = @imagecreatefromstring((string) file_get_contents($file->getRealPath()));

        if ($source === false) {
            throw new RuntimeException('Image illisible.');
        }

        $width = imagesx($source);
        $height = imagesy($source);

        if ($width > self::MAX_WIDTH) {
            $resized = imagescale($source, self::MAX_WIDTH, (int) round($height * self::MAX_WIDTH / $width));
            imagedestroy($source);
            $source = $resized;
        }

        ob_start();
        imagewebp($source, null, self::QUALITY);
        $contents = (string) ob_get_clean();
        imagedestroy($source);

        $path = trim($directory, '/').'/'.Str::uuid().'.webp';
        Storage::disk($disk)->put($path, $contents);

        return $path;
    }
}
