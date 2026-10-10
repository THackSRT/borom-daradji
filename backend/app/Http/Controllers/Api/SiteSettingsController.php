<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateSiteSectionRequest;
use App\Http\Resources\PublicCompanyResource;
use App\Models\CompanySetting;
use App\Support\ImageOptimizer;
use App\Support\SiteContent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Contenu du site vitrine, modifiable par le dirigeant (écran « Site internet »).
 */
class SiteSettingsController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json(['data' => $this->payload(CompanySetting::current())]);
    }

    public function update(UpdateSiteSectionRequest $request, string $section): JsonResponse
    {
        $settings = CompanySetting::current();
        SiteContent::saveSection($settings, $section, $request->validated());

        return response()->json(['data' => $this->payload($settings)]);
    }

    public function reset(string $section): JsonResponse
    {
        $settings = CompanySetting::current();
        SiteContent::resetSection($settings, $section);

        return response()->json(['data' => $this->payload($settings)]);
    }

    /**
     * Envoi d'une image (fond d'accueil, réalisation) : convertie en WebP, utilisée ensuite dans une section.
     */
    public function storeImage(Request $request): JsonResponse
    {
        $request->validate([
            'image' => ['required', 'image', 'mimes:png,jpg,jpeg,webp', 'max:8192'],
        ]);

        $path = ImageOptimizer::storeAsWebp($request->file('image'), 'site');

        return response()->json(['data' => ['path' => $path, 'url' => SiteContent::url($path)]], 201);
    }

    /**
     * Tout ce dont le site vitrine a besoin en un appel : coordonnées et contenu.
     */
    public function showPublic(Request $request): JsonResponse
    {
        $settings = CompanySetting::current();
        $content = SiteContent::public($settings);

        $company = (new PublicCompanyResource($settings))->toArray($request);
        if ($content['legal']['show_identifiers']) {
            $company += ['legal_name' => $settings->legal_name, 'ninea' => $settings->ninea, 'rccm' => $settings->rccm];
        }

        return response()->json(['data' => ['company' => $company, 'content' => $content]]);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(CompanySetting $settings): array
    {
        $content = SiteContent::for($settings);

        return [
            'content' => $content,
            'defaults' => SiteContent::defaults(),
            'customized' => array_keys($settings->site ?? []),
            'image_urls' => SiteContent::imageUrls($content),
            'icons' => SiteContent::ICONS,
        ];
    }
}
