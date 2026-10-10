<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\PaymentRequest;
use App\Http\Resources\InvoiceResource;
use App\Http\Resources\PaymentResource;
use App\Models\Invoice;
use App\Models\Payment;
use App\Services\Billing;
use App\Support\ActivityLogger;
use App\Support\InvoicePdf;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PaymentController extends Controller
{
    /**
     * Encaissements : le comptable voit ceux de toute l'équipe, les autres seulement les leurs.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('useCash', Invoice::class);

        $query = Payment::query()->with(['invoice', 'client', 'receiver']);

        if (! $request->user()->can('viewAllPayments', Invoice::class)) {
            $query->where('received_by', $request->user()->id);
        } elseif ($request->filled('received_by')) {
            $query->where('received_by', $request->query('received_by'));
        }
        if ($request->filled('from')) {
            $query->whereDate('paid_on', '>=', $request->query('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('paid_on', '<=', $request->query('to'));
        }
        if ($request->filled('method')) {
            $query->where('method', $request->query('method'));
        }
        if ($search = trim((string) $request->query('search'))) {
            $query->where(fn ($q) => $q->where('number', 'like', "%{$search}%")
                ->orWhere('reference', 'like', "%{$search}%")
                ->orWhereHas('client', fn ($c) => $c->where('name', 'like', "%{$search}%")));
        }

        $totals = (clone $query)->valid()->selectRaw('method, sum(amount) as total, count(*) as count')->groupBy('method')->get();

        return PaymentResource::collection($query->latest('paid_on')->latest('id')->paginate(min((int) $request->query('per_page', 25), 100)))
            ->additional(['summary' => [
                'total' => (int) $totals->sum('total'),
                'by_method' => $totals->map(fn ($row) => ['method' => $row->method->toOption(), 'total' => (int) $row->total, 'count' => (int) $row->count])->values(),
            ]]);
    }

    public function store(PaymentRequest $request, Invoice $invoice): InvoiceResource
    {
        Billing::recordPayment($invoice, $request->safe()->except('proof'), $request->user(), $request->file('proof'));

        return new InvoiceResource($invoice->fresh()->load(['client', 'property', 'lines', 'creditedInvoice', 'creditNotes', 'payments.receiver']));
    }

    public function cancel(Request $request, Payment $payment): PaymentResource
    {
        Gate::authorize('cancelPayment', Invoice::class);

        $data = $request->validate(['reason' => ['required', 'string', 'min:5', 'max:500']], [], ['reason' => 'motif']);

        return new PaymentResource(Billing::cancelPayment($payment, $data['reason'], $request->user())->load('receiver'));
    }

    public function receipt(Request $request, Payment $payment): Response
    {
        $this->authorizePayment($request, $payment);

        return InvoicePdf::receipt($payment);
    }

    public function proof(Request $request, Payment $payment): StreamedResponse
    {
        $this->authorizePayment($request, $payment);
        abort_unless($payment->proof_path, 404);

        ActivityLogger::log('downloaded', $payment, "Consultation du justificatif du reçu {$payment->number}");

        return Storage::disk('local')->download($payment->proof_path, "justificatif-{$payment->number}.".pathinfo($payment->proof_path, PATHINFO_EXTENSION));
    }

    private function authorizePayment(Request $request, Payment $payment): void
    {
        $user = $request->user();
        abort_unless($payment->received_by === $user->id || $user->can('view', $payment->invoice), 403);
    }
}
