<?php

namespace App\Http\Controllers\Api;

use App\Enums\ClientCategory;
use App\Enums\PipelineStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\ClientRequest;
use App\Http\Resources\ClientResource;
use App\Models\Client;
use App\Support\PhoneNumber;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class ClientController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', Rule::enum(ClientCategory::class)],
            'pipeline_status' => ['nullable', Rule::enum(PipelineStatus::class)],
            'assigned_user_id' => ['nullable', 'integer'],
            'mine' => ['nullable', 'boolean'],
            'tag' => ['nullable', 'string', 'max:40'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $clients = Client::query()
            ->with('assignedUser:id,name')
            ->when($filters['search'] ?? null, function ($query, string $search) {
                // Un numéro tapé « 77 123 45 67 », ou seulement son début « 77 555 », doit retrouver « +221771234567 ».
                $phone = PhoneNumber::normalize($search);
                $digits = preg_replace('/\D+/', '', $search);
                $looksLikePhone = strlen($digits) >= 3 && preg_match('/^[\d\s.+\-]+$/', $search);
                $query->where(fn ($q) => $q
                    ->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', '%'.($phone ?? ($looksLikePhone ? $digits : $search)).'%'));
            })
            ->when($filters['category'] ?? null, fn ($q, $v) => $q->whereJsonContains('categories', $v))
            ->when($filters['pipeline_status'] ?? null, fn ($q, $v) => $q->where('pipeline_status', $v))
            ->when($filters['assigned_user_id'] ?? null, fn ($q, $v) => $q->where('assigned_user_id', $v))
            ->when($request->boolean('mine'), fn ($q) => $q->where('assigned_user_id', $request->user()->id))
            ->when($filters['tag'] ?? null, fn ($q, $v) => $q->whereJsonContains('tags', $v))
            ->orderByDesc('last_contact_at')
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 25) ?: 25)
            ->withQueryString();

        return ClientResource::collection($clients);
    }

    /**
     * Un téléphone déjà connu ne crée pas de doublon : on renvoie la fiche existante (409).
     */
    public function store(ClientRequest $request): JsonResponse|ClientResource
    {
        $data = $request->validated();

        if (! empty($data['phone'])) {
            $existing = Client::withTrashed()->where('phone', $data['phone'])->first();

            if ($existing) {
                return response()->json([
                    'message' => $existing->trashed()
                        ? "Ce numéro appartient à un client archivé : {$existing->name}."
                        : "Ce numéro appartient déjà à {$existing->name}.",
                    'client' => new ClientResource($existing->load('assignedUser')),
                ], Response::HTTP_CONFLICT);
            }
        }

        $client = new Client($data);
        $client->assigned_user_id ??= $request->user()->id;
        $client->save();

        return new ClientResource($client->load('assignedUser'));
    }

    public function show(Client $client): ClientResource
    {
        Gate::authorize('view', $client);

        return new ClientResource($client->load([
            'assignedUser',
            'searchCriteria',
            'interactions' => fn ($q) => $q->with(['user:id,name', 'property:id,reference'])->limit(50),
            'visits' => fn ($q) => $q->with(['property:id,reference,title,neighborhood', 'agent:id,name'])->limit(50),
        ]));
    }

    public function update(ClientRequest $request, Client $client): ClientResource
    {
        $client->update($request->validated());

        return new ClientResource($client->load('assignedUser'));
    }

    public function destroy(Client $client): Response
    {
        Gate::authorize('delete', $client);

        $client->delete();

        return response()->noContent();
    }
}
