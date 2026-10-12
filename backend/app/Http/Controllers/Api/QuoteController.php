<?php

namespace App\Http\Controllers\Api;

use App\Enums\QuoteStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\QuoteResource;
use App\Models\Quote;
use App\Services\QuoteService;
use App\Support\InvoicePdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class QuoteController extends Controller
{
    public function __construct(private readonly QuoteService $quotes) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Quote::class);
        $templates = $request->boolean('templates');

        $query = Quote::query()->with(['client', 'worksite'])->withCount('lots')
            ->where('is_template', $templates);
        if ($search = trim((string) $request->query('search'))) {
            $query->where(fn ($q) => $q->whereLike('number', "%{$search}%")->orWhereLike('title', "%{$search}%")
                ->orWhereLike('template_name', "%{$search}%")
                ->orWhereHas('client', fn ($c) => $c->whereLike('name', "%{$search}%")));
        }
        foreach (['status', 'client_id', 'worksite_id'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->query($filter));
            }
        }

        $base = Quote::query()->quotes();

        return QuoteResource::collection($query->orderByRaw("status = 'brouillon' desc")->latest('id')->paginate(min((int) $request->query('per_page', 25), 100)))
            ->additional(['summary' => [
                'drafts' => (clone $base)->where('status', QuoteStatus::Brouillon)->count(),
                'pending' => (clone $base)->where('status', QuoteStatus::Envoye)->count(),
                'pending_total' => (int) (clone $base)->where('status', QuoteStatus::Envoye)->sum('total'),
                'accepted_this_year' => (int) (clone $base)->where('status', QuoteStatus::Accepte)->whereYear('decided_at', now()->year)->sum('total'),
            ]]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validated($request, creating: true);
        $user = $request->user();

        // À partir d'un modèle ou d'un devis existant (copie).
        if (! empty($data['source_id'])) {
            $source = Quote::query()->findOrFail($data['source_id']);
            Gate::authorize('view', $source);
            $this->authorizeCreation($request, (bool) ($data['is_template'] ?? false));
            $quote = $this->quotes->duplicate($source, $data, $user);
        } else {
            $this->authorizeCreation($request, (bool) ($data['is_template'] ?? false));
            if (! ($data['is_template'] ?? false) && empty($data['client_id'])) {
                throw ValidationException::withMessages(['client_id' => 'Choisissez le client du devis.']);
            }
            $quote = $this->quotes->save(new Quote([
                'deposit_rate' => config('borom.quote_deposit_rate'),
                'conditions' => config('borom.quote_conditions'),
            ]), collect($data)->except(['lots', 'source_id'])->all(), $data['lots'] ?? [], $user);
        }

        return (new QuoteResource($this->loaded($quote)))->response()->setStatusCode(201);
    }

    public function show(Quote $quote): QuoteResource
    {
        Gate::authorize('view', $quote);

        return new QuoteResource($this->loaded($quote));
    }

    public function update(Request $request, Quote $quote): QuoteResource
    {
        Gate::authorize('update', $quote);
        $data = $this->validated($request);
        if (! $quote->is_template && array_key_exists('client_id', $data) && ! $data['client_id']) {
            throw ValidationException::withMessages(['client_id' => 'Choisissez le client du devis.']);
        }
        $this->quotes->save($quote, collect($data)->except(['lots', 'source_id', 'is_template'])->all(), $data['lots'] ?? $this->currentLots($quote));

        return new QuoteResource($this->loaded($quote));
    }

    public function destroy(Quote $quote): Response
    {
        Gate::authorize('delete', $quote);
        if (! $quote->isDraft()) {
            throw ValidationException::withMessages(['quote' => 'Seul un brouillon se supprime.']);
        }
        $quote->delete();

        return response()->noContent();
    }

    public function send(Quote $quote): QuoteResource
    {
        Gate::authorize('update', $quote);

        return new QuoteResource($this->loaded($this->quotes->send($quote)));
    }

    public function accept(Request $request, Quote $quote): QuoteResource
    {
        Gate::authorize('update', $quote);
        $data = $request->validate(['worksite_id' => ['nullable', 'integer', 'exists:worksites,id']], [], ['worksite_id' => 'chantier']);

        return new QuoteResource($this->loaded($this->quotes->accept($quote, $request->user(), $data['worksite_id'] ?? null)));
    }

    public function refuse(Request $request, Quote $quote): QuoteResource
    {
        Gate::authorize('update', $quote);
        $data = $request->validate(['reason' => ['required', 'string', 'max:500']], [], ['reason' => 'motif']);

        return new QuoteResource($this->loaded($this->quotes->refuse($quote, $data['reason'])));
    }

    public function reopen(Quote $quote): QuoteResource
    {
        Gate::authorize('update', $quote);

        return new QuoteResource($this->loaded($this->quotes->reopen($quote)));
    }

    public function pdf(Quote $quote): Response
    {
        Gate::authorize('view', $quote);

        return InvoicePdf::quote($quote);
    }

    /** Un modèle relève du catalogue (« works.catalog »), un devis de « works.quotes ». */
    private function authorizeCreation(Request $request, bool $template): void
    {
        if ($template) {
            abort_unless($request->user()->hasPermission('works.catalog'), 403);
        } else {
            Gate::authorize('create', Quote::class);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, bool $creating = false): array
    {
        return $request->validate([
            'source_id' => ['nullable', 'integer'],
            'is_template' => ['sometimes', 'boolean'],
            'template_name' => ['nullable', 'string', 'max:120'],
            'client_id' => ['nullable', 'integer', 'exists:clients,id'],
            'property_id' => ['nullable', 'integer', 'exists:properties,id'],
            'title' => [$creating ? 'required_without:source_id' : 'sometimes', 'nullable', 'string', 'max:255'],
            'site_address' => ['nullable', 'string', 'max:255'],
            'discount_rate' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'deposit_rate' => ['sometimes', 'numeric', 'min:0', 'max:100'],
            'conditions' => ['nullable', 'string', 'max:5000'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'lots' => ['sometimes', 'array', 'max:50'],
            'lots.*.title' => ['required', 'string', 'max:255'],
            'lots.*.trade_id' => ['nullable', 'integer', 'exists:trades,id'],
            'lots.*.lines' => ['sometimes', 'array', 'max:200'],
            'lots.*.lines.*.catalog_item_id' => ['nullable', 'integer', Rule::exists('catalog_items', 'id')],
            'lots.*.lines.*.designation' => ['required', 'string', 'max:500'],
            'lots.*.lines.*.unit' => ['nullable', 'string', 'max:20'],
            'lots.*.lines.*.quantity' => ['required', 'numeric', 'min:0.01', 'max:9999999'],
            'lots.*.lines.*.unit_price' => ['required', 'integer', 'min:0'],
            'lots.*.lines.*.vat_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ], [], [
            'client_id' => 'client', 'title' => 'objet du devis', 'discount_rate' => 'remise', 'deposit_rate' => 'acompte',
            'lots.*.title' => 'titre du lot', 'lots.*.lines.*.designation' => 'désignation', 'lots.*.lines.*.quantity' => 'quantité',
            'lots.*.lines.*.unit_price' => 'prix unitaire',
        ]);
    }

    /**
     * Lots actuels, pour un enregistrement qui ne change que l'en-tête (la remise recalcule tout).
     *
     * @return list<array<string, mixed>>
     */
    private function currentLots(Quote $quote): array
    {
        return $quote->lots()->with('lines')->get()->map(fn ($lot) => [
            'title' => $lot->title,
            'trade_id' => $lot->trade_id,
            'lines' => $lot->lines->map(fn ($l) => $l->only(['catalog_item_id', 'designation', 'unit', 'quantity', 'unit_price', 'vat_rate']))->all(),
        ])->all();
    }

    private function loaded(Quote $quote): Quote
    {
        return $quote->fresh(['client', 'property', 'worksite', 'creator', 'lots.lines']);
    }
}
