<?php

namespace App\Http\Controllers\Api;

use App\Enums\ClientDocumentType;
use App\Http\Controllers\Controller;
use App\Http\Resources\DocumentResource;
use App\Models\Client;
use App\Models\ClientDocument;
use App\Support\ActivityLogger;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Pièces d'identité et justificatifs (loi n° 2008-12) : disque privé, accès restreint, chaque consultation tracée.
 */
class ClientDocumentController extends Controller
{
    public function index(Client $client): AnonymousResourceCollection
    {
        Gate::authorize('viewDocuments', $client);

        return DocumentResource::collection($client->documents()->latest()->get());
    }

    public function store(Request $request, Client $client): DocumentResource
    {
        Gate::authorize('manageDocuments', $client);

        $data = $request->validate([
            'type' => ['required', Rule::enum(ClientDocumentType::class)],
            'document' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],
        ]);

        $file = $request->file('document');

        $document = $client->documents()->create([
            'type' => $data['type'],
            'path' => $file->store("client-documents/{$client->id}", 'local'),
            'original_name' => $file->getClientOriginalName(),
            'uploaded_by' => $request->user()->id,
        ]);

        return new DocumentResource($document);
    }

    public function download(Client $client, ClientDocument $document): StreamedResponse
    {
        Gate::authorize('viewDocuments', $client);

        ActivityLogger::log('downloaded', $document, "Consultation de « {$document->original_name} » ({$client->name})");

        return Storage::disk('local')->download($document->path, $document->original_name);
    }

    public function destroy(Client $client, ClientDocument $document): Response
    {
        Gate::authorize('viewDocuments', $client);

        Storage::disk('local')->delete($document->path);
        $document->delete();

        return response()->noContent();
    }
}
