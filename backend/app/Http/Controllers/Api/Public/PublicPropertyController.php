<?php

namespace App\Http\Controllers\Api\Public;

use App\Enums\PropertyType;
use App\Enums\TransactionType;
use App\Http\Controllers\Controller;
use App\Http\Resources\PublicPropertyResource;
use App\Models\Property;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

/**
 * Catalogue du site vitrine. Les noms de filtres reprennent ceux du site existant.
 */
class PublicPropertyController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'type' => ['nullable', Rule::enum(PropertyType::class)],
            'transaction' => ['nullable', Rule::enum(TransactionType::class)],
            'city' => ['nullable', 'string', 'max:100'],
            'neighborhood' => ['nullable', 'string', 'max:100'],
            'priceMin' => ['nullable', 'integer', 'min:0'],
            'priceMax' => ['nullable', 'integer', 'min:0'],
            'surfaceMin' => ['nullable', 'integer', 'min:0'],
            'search' => ['nullable', 'string', 'max:100'],
            'featured' => ['nullable', 'boolean'],
            'sort' => ['nullable', Rule::in(['recent', 'price_asc', 'price_desc', 'surface_desc'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:48'],
        ]);

        $properties = Property::query()
            ->published()
            ->with('cover')
            ->when($filters['type'] ?? null, fn ($q, $v) => $q->where('type', $v))
            ->when($filters['transaction'] ?? null, fn ($q, $v) => $q->where('transaction', $v))
            ->when($filters['city'] ?? null, fn ($q, $v) => $q->where('city', $v))
            ->when($filters['neighborhood'] ?? null, fn ($q, $v) => $q->where('neighborhood', $v))
            ->when($filters['priceMin'] ?? null, fn ($q, $v) => $q->where('price', '>=', $v))
            ->when($filters['priceMax'] ?? null, fn ($q, $v) => $q->where('price', '<=', $v))
            ->when($filters['surfaceMin'] ?? null, fn ($q, $v) => $q->where('surface', '>=', $v))
            ->when($filters['search'] ?? null, fn ($q, $v) => $q->where(fn ($q) => $q
                ->whereLike('title', "%{$v}%")
                ->orWhereLike('neighborhood', "%{$v}%")
                ->orWhereLike('reference', "%{$v}%")))
            ->when($request->boolean('featured'), fn ($q) => $q->where('is_featured', true))
            ->when($filters['sort'] ?? 'recent', fn ($q, $sort) => match ($sort) {
                'price_asc' => $q->orderBy('price'),
                'price_desc' => $q->orderByDesc('price'),
                'surface_desc' => $q->orderByDesc('surface'),
                default => $q->orderByDesc('published_at'),
            })
            ->paginate($filters['per_page'] ?? 12)
            ->withQueryString();

        return PublicPropertyResource::collection($properties);
    }

    public function show(string $slug): PublicPropertyResource
    {
        $property = Property::published()->where('slug', $slug)->with(['cover', 'photos'])->firstOrFail();

        return new PublicPropertyResource($property);
    }

    /**
     * Villes et quartiers réellement présents dans le catalogue, pour les filtres du site.
     */
    public function places(): JsonResponse
    {
        $rows = Property::published()
            ->select('city', 'neighborhood')
            ->distinct()
            ->orderBy('city')
            ->orderBy('neighborhood')
            ->get();

        return response()->json([
            'data' => $rows->groupBy('city')->map(fn ($group, $city) => [
                'city' => $city,
                'neighborhoods' => $group->pluck('neighborhood')->filter()->values(),
            ])->values(),
        ]);
    }
}
