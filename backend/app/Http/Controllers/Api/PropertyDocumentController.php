<?php

namespace App\Http\Controllers\Api;

use App\Enums\PropertyDocumentType;
use App\Http\Controllers\Controller;
use App\Http\Resources\DocumentResource;
use App\Models\Property;
use App\Models\PropertyDocument;
use App\Support\ActivityLogger;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Pièces d'un bien : disque privé, téléchargement contrôlé et journalisé.
 */
class PropertyDocumentController extends Controller
{
    public function index(Property $property): AnonymousResourceCollection
    {
        Gate::authorize('viewDocuments', $property);

        return DocumentResource::collection($property->documents()->latest()->get());
    }

    public function store(Request $request, Property $property): DocumentResource
    {
        Gate::authorize('update', $property);

        $data = $request->validate([
            'type' => ['required', Rule::enum(PropertyDocumentType::class)],
            'document' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],
        ]);

        $file = $request->file('document');

        $document = $property->documents()->create([
            'type' => $data['type'],
            'path' => $file->store("property-documents/{$property->id}", 'local'),
            'original_name' => $file->getClientOriginalName(),
            'uploaded_by' => $request->user()->id,
        ]);

        return new DocumentResource($document);
    }

    public function download(Property $property, PropertyDocument $document): StreamedResponse
    {
        Gate::authorize('viewDocuments', $property);

        ActivityLogger::log('downloaded', $document, "Téléchargement de « {$document->original_name} »");

        return Storage::disk('local')->download($document->path, $document->original_name);
    }

    public function destroy(Property $property, PropertyDocument $document): Response
    {
        Gate::authorize('update', $property);

        Storage::disk('local')->delete($document->path);
        $document->delete();

        return response()->noContent();
    }
}
