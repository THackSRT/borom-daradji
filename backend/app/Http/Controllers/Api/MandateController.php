<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\MandateRequest;
use App\Http\Resources\MandateResource;
use App\Models\Mandate;
use App\Models\Property;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

class MandateController extends Controller
{
    public function index(Property $property): AnonymousResourceCollection
    {
        Gate::authorize('viewMandates', $property);

        return MandateResource::collection($property->mandates()->with('owner')->get());
    }

    public function store(MandateRequest $request, Property $property): MandateResource
    {
        $mandate = $property->mandates()->create([
            'owner_id' => $property->owner_id,
            ...$request->validated(),
        ]);

        return new MandateResource($mandate->load('owner'));
    }

    public function update(MandateRequest $request, Property $property, Mandate $mandate): MandateResource
    {
        $mandate->fill($request->validated());
        // Prolonger un mandat relance l'alerte d'expiration.
        if ($mandate->isDirty('ends_on')) {
            $mandate->expiry_alerted_at = null;
        }
        $mandate->save();

        return new MandateResource($mandate->load('owner'));
    }
}
