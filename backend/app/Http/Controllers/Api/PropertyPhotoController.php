<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PropertyPhotoResource;
use App\Models\Property;
use App\Models\PropertyPhoto;
use App\Support\ImageOptimizer;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class PropertyPhotoController extends Controller
{
    public function store(Request $request, Property $property): AnonymousResourceCollection
    {
        Gate::authorize('update', $property);

        $request->validate([
            'photos' => ['required', 'array', 'min:1'],
            'photos.*' => ['image', 'mimes:jpg,jpeg,png,webp', 'max:10240'],
        ]);

        $max = config('borom.max_photos_per_property');
        $existing = $property->photos()->count();

        if ($existing + count($request->file('photos')) > $max) {
            throw ValidationException::withMessages([
                'photos' => "Un bien ne peut pas avoir plus de {$max} photos ({$existing} déjà en ligne).",
            ]);
        }

        $position = (int) $property->photos()->max('position');

        foreach ($request->file('photos') as $file) {
            $property->photos()->create([
                'path' => ImageOptimizer::storeAsWebp($file, "properties/{$property->id}"),
                'position' => ++$position,
                // La première photo devient la photo principale.
                'is_cover' => $existing === 0 && $position === 1,
            ]);
        }

        return PropertyPhotoResource::collection($property->photos()->get());
    }

    public function setCover(Property $property, PropertyPhoto $photo): AnonymousResourceCollection
    {
        Gate::authorize('update', $property);

        DB::transaction(function () use ($property, $photo) {
            $property->photos()->update(['is_cover' => false]);
            $photo->update(['is_cover' => true]);
        });

        return PropertyPhotoResource::collection($property->photos()->get());
    }

    public function reorder(Request $request, Property $property): AnonymousResourceCollection
    {
        Gate::authorize('update', $property);

        $ids = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['integer', 'distinct'],
        ])['ids'];

        if (collect($ids)->sort()->values()->all() !== $property->photos()->pluck('id')->sort()->values()->all()) {
            throw ValidationException::withMessages(['ids' => 'La liste doit contenir toutes les photos du bien, une seule fois.']);
        }

        DB::transaction(function () use ($property, $ids) {
            foreach ($ids as $index => $id) {
                $property->photos()->whereKey($id)->update(['position' => $index + 1]);
            }
        });

        return PropertyPhotoResource::collection($property->photos()->get());
    }

    public function destroy(Property $property, PropertyPhoto $photo): AnonymousResourceCollection
    {
        Gate::authorize('update', $property);

        $wasCover = $photo->is_cover;
        Storage::disk('public')->delete($photo->path);
        $photo->delete();

        if ($wasCover) {
            $property->photos()->first()?->update(['is_cover' => true]);
        }

        return PropertyPhotoResource::collection($property->photos()->get());
    }
}
