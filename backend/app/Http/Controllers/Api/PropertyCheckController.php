<?php

namespace App\Http\Controllers\Api;

use App\Enums\CheckStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\PropertyCheckRequest;
use App\Http\Resources\PropertyCheckResource;
use App\Models\Property;
use App\Models\PropertyCheck;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

/**
 * Vérification foncière : un point à la fois, avec qui l'a vérifié et quand.
 */
class PropertyCheckController extends Controller
{
    public function index(Property $property): AnonymousResourceCollection
    {
        Gate::authorize('view', $property);

        return PropertyCheckResource::collection($property->checks()->with('checker')->get());
    }

    public function update(PropertyCheckRequest $request, Property $property, PropertyCheck $check): PropertyCheckResource
    {
        $status = CheckStatus::from($request->string('status')->toString());

        $check->fill($request->validated());
        $check->checked_by = $status === CheckStatus::AFaire ? null : $request->user()->id;
        $check->checked_at = $status === CheckStatus::AFaire ? null : now();
        $check->save();

        return new PropertyCheckResource($check->load('checker'));
    }
}
