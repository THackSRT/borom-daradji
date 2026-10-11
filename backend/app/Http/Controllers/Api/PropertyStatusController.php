<?php

namespace App\Http\Controllers\Api;

use App\Enums\PropertyStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\ChangePropertyStatusRequest;
use App\Http\Resources\PropertyResource;
use App\Models\Property;
use App\Services\PropertyStatusService;

class PropertyStatusController extends Controller
{
    public function store(ChangePropertyStatusRequest $request, Property $property, PropertyStatusService $service): PropertyResource
    {
        $service->transition(
            $property,
            PropertyStatus::from($request->string('status')->toString()),
            $request->input('reason'),
            $request->user(),
        );

        return new PropertyResource($property->load(['cover', 'checks.checker', 'statusChanges.user']));
    }
}
