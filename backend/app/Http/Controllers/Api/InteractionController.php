<?php

namespace App\Http\Controllers\Api;

use App\Enums\PipelineStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\InteractionRequest;
use App\Http\Resources\InteractionResource;
use App\Models\Client;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;

class InteractionController extends Controller
{
    public function index(Client $client): AnonymousResourceCollection
    {
        Gate::authorize('view', $client);

        return InteractionResource::collection(
            $client->interactions()->with(['user:id,name', 'property:id,reference'])->paginate(50)
        );
    }

    public function store(InteractionRequest $request, Client $client): InteractionResource
    {
        $interaction = $client->interactions()->create([
            ...$request->validated(),
            'user_id' => $request->user()->id,
            'occurred_at' => $request->date('occurred_at') ?? now(),
        ]);

        // Un premier échange fait passer le prospect de « nouveau » à « contacté ».
        $client->refresh();
        $client->advancePipeline(PipelineStatus::Contacte);
        $client->save();

        return new InteractionResource($interaction->load(['user', 'property']));
    }
}
