<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Http\Requests\LeadRequest;
use App\Models\Property;
use App\Services\LeadIntake;
use Illuminate\Http\JsonResponse;

class LeadController extends Controller
{
    public function store(LeadRequest $request, LeadIntake $intake): JsonResponse
    {
        $response = response()->json(['message' => 'Merci, votre demande a bien été envoyée. Nous vous rappelons rapidement.'], 202);

        // Champ piège rempli : on répond comme si tout allait bien, sans rien enregistrer.
        if ($request->filled('website')) {
            return $response;
        }

        $property = $request->filled('property')
            ? Property::published()->where('slug', $request->input('property'))->first()
            : null;

        $intake->handle($request->safe()->only(['name', 'phone', 'email', 'message']), $property);

        return $response;
    }
}
