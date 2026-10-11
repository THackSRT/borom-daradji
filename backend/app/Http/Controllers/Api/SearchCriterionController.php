<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SearchCriterionRequest;
use App\Http\Resources\PropertyResource;
use App\Http\Resources\SearchCriterionResource;
use App\Models\Client;
use App\Models\SearchCriterion;
use App\Services\ProspectMatcher;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

class SearchCriterionController extends Controller
{
    public function store(SearchCriterionRequest $request, Client $client): SearchCriterionResource
    {
        return new SearchCriterionResource($client->searchCriteria()->create($request->validated()));
    }

    public function update(SearchCriterionRequest $request, Client $client, SearchCriterion $searchCriterion): SearchCriterionResource
    {
        $searchCriterion->update($request->validated());

        return new SearchCriterionResource($searchCriterion);
    }

    public function destroy(Client $client, SearchCriterion $searchCriterion): Response
    {
        Gate::authorize('manageProspection', $client);

        $searchCriterion->delete();

        return response()->noContent();
    }

    /**
     * Biens publiés qui correspondent aux critères actifs du client.
     */
    public function matches(Client $client, ProspectMatcher $matcher): AnonymousResourceCollection
    {
        Gate::authorize('view', $client);

        return PropertyResource::collection($matcher->propertiesFor($client));
    }
}
