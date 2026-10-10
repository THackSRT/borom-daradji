<?php

namespace App\Http\Controllers\Api;

use App\Enums\InvoiceStatus;
use App\Enums\InvoiceType;
use App\Http\Controllers\Controller;
use App\Http\Requests\InvoiceRequest;
use App\Http\Resources\InvoiceResource;
use App\Models\Invoice;
use App\Services\Billing;
use App\Support\ActivityLogger;
use App\Support\InvoicePdf;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

class InvoiceController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('viewAny', Invoice::class);

        $query = Invoice::query()->with('client');

        if ($search = trim((string) $request->query('search'))) {
            $query->where(fn ($q) => $q->where('number', 'like', "%{$search}%")
                ->orWhereHas('client', fn ($c) => $c->where('name', 'like', "%{$search}%")));
        }
        foreach (['client_id', 'property_id', 'activity', 'type', 'status'] as $filter) {
            if ($request->filled($filter)) {
                $query->where($filter, $request->query($filter));
            }
        }
        match ($request->query('state')) {
            'a_encaisser' => $query->outstanding(),
            'en_retard' => $query->overdue(),
            'payee' => $query->where('type', InvoiceType::Facture)->where('status', InvoiceStatus::Emise)->whereRaw('total - credited_total - paid_total <= 0'),
            default => null,
        };

        $invoices = $query->orderByRaw("status = 'brouillon' desc")->latest('issue_date')->latest('id')
            ->paginate(min((int) $request->query('per_page', 25), 100));

        return InvoiceResource::collection($invoices)->additional(['summary' => [
            'outstanding' => (int) Invoice::query()->outstanding()->sum(DB::raw('total - credited_total - paid_total')),
            'overdue' => (int) Invoice::query()->overdue()->sum(DB::raw('total - credited_total - paid_total')),
            'overdue_count' => Invoice::query()->overdue()->count(),
            'drafts' => Invoice::query()->where('status', InvoiceStatus::Brouillon)->count(),
        ]]);
    }

    public function store(InvoiceRequest $request): InvoiceResource
    {
        $invoice = Billing::saveDraft(
            new Invoice(['type' => InvoiceType::Facture, 'created_by' => $request->user()->id]),
            $request->safe()->except('lines'),
            $request->validated('lines'),
        );

        return new InvoiceResource($this->loaded($invoice));
    }

    public function show(Invoice $invoice): InvoiceResource
    {
        Gate::authorize('view', $invoice);

        return new InvoiceResource($this->loaded($invoice));
    }

    public function update(InvoiceRequest $request, Invoice $invoice): InvoiceResource
    {
        Billing::saveDraft($invoice, $request->safe()->except('lines'), $request->validated('lines'));

        return new InvoiceResource($this->loaded($invoice));
    }

    public function destroy(Invoice $invoice): Response
    {
        Gate::authorize('delete', $invoice);

        if (! $invoice->isDraft()) {
            throw ValidationException::withMessages(['invoice' => 'Une facture émise ne se supprime pas : établissez un avoir.']);
        }

        $invoice->delete();

        return response()->noContent();
    }

    public function issue(Request $request, Invoice $invoice): InvoiceResource
    {
        Gate::authorize('update', $invoice);

        return new InvoiceResource($this->loaded(Billing::issue($invoice, $request->user())));
    }

    /**
     * Prépare un avoir (brouillon) reprenant les lignes de la facture.
     */
    public function creditNote(Request $request, Invoice $invoice): InvoiceResource
    {
        Gate::authorize('update', $invoice);

        return new InvoiceResource($this->loaded(Billing::prepareCreditNote($invoice, $request->user())));
    }

    public function pdf(Invoice $invoice): Response
    {
        Gate::authorize('view', $invoice);

        if (! $invoice->isDraft()) {
            ActivityLogger::log('downloaded', $invoice, "Téléchargement du PDF {$invoice->number}");
        }

        return InvoicePdf::invoice($invoice);
    }

    private function loaded(Invoice $invoice): Invoice
    {
        return $invoice->load(['client', 'property', 'lines', 'creditedInvoice', 'creditNotes', 'payments.receiver']);
    }
}
