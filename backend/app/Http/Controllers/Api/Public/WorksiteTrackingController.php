<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Models\Worksite;
use App\Models\WorksiteInvoice;
use App\Models\WorksiteLog;
use App\Models\WorksiteLot;
use App\Models\WorksitePhoto;
use App\Services\WorksBilling;
use App\Support\InvoicePdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Lien de suivi du client (/suivi/{jeton}) : lecture seule, sans compte. Avancement des lots, journal et
 * photos marqués « visibles du client », factures émises et paiements. Le jeton est long et aléatoire ;
 * le renouveler ou le révoquer depuis la fiche du chantier coupe l'ancien lien. Rien de ce qui est
 * interne (budget, coûts, tâcherons, caisse) n'est exposé.
 */
class WorksiteTrackingController extends Controller
{
    private const HEADERS = ['X-Robots-Tag' => 'noindex, nofollow', 'Cache-Control' => 'private, no-store'];

    public function show(string $token, WorksBilling $billing): JsonResponse
    {
        $worksite = $this->find($token)->load(['client', 'manager', 'lots', 'logs', 'photos']);
        $invoices = $billing->history($worksite)->filter(fn (WorksiteInvoice $wi) => ! $wi->invoice->isDraft())->values();

        return response()->json(['data' => [
            'reference' => $worksite->reference,
            'title' => $worksite->title,
            'address' => $worksite->address,
            'client_name' => $worksite->client->name,
            'status' => $worksite->status->toOption(),
            'progress' => $worksite->progress(),
            'manager' => $worksite->manager?->name,
            'start_date' => $worksite->start_date?->toDateString(),
            'planned_end_date' => $worksite->planned_end_date?->toDateString(),
            'actual_end_date' => $worksite->actual_end_date?->toDateString(),
            'lots' => $worksite->lots->map(fn (WorksiteLot $l) => ['id' => $l->id, 'title' => $l->title, 'progress' => $l->progress]),
            'logs' => $worksite->logs->where('is_public', true)->take(50)->values()->map(fn (WorksiteLog $l) => [
                'id' => $l->id, 'logged_on' => $l->logged_on->toDateString(), 'kind' => $l->kind, 'body' => $l->body,
            ]),
            'photos' => $worksite->photos->where('is_public', true)->values()->map(fn (WorksitePhoto $p) => [
                'id' => $p->id, 'caption' => $p->caption, 'taken_at' => $p->taken_at->toIso8601String(), 'lot_id' => $p->worksite_lot_id,
                'url' => "/public/worksites/{$token}/photos/{$p->id}",
            ]),
            'billing' => [
                'contract_total' => $worksite->contract_total,
                'invoiced_total' => (int) $invoices->sum(fn (WorksiteInvoice $wi) => $wi->invoice->total),
                'paid_total' => (int) $invoices->sum(fn (WorksiteInvoice $wi) => $wi->invoice->paid_total),
                'balance' => (int) $invoices->sum(fn (WorksiteInvoice $wi) => max(0, $wi->invoice->balance())),
                'invoices' => $invoices->map(fn (WorksiteInvoice $wi) => [
                    'id' => $wi->invoice->id,
                    'label' => WorksBilling::KINDS[$wi->kind].($wi->kind === 'situation' ? " n° {$wi->sequence}" : ''),
                    'number' => $wi->invoice->number,
                    'issue_date' => $wi->invoice->issue_date?->toDateString(),
                    'due_date' => $wi->invoice->due_date?->toDateString(),
                    'total' => $wi->invoice->total,
                    'paid_total' => $wi->invoice->paid_total,
                    'balance' => $wi->invoice->balance(),
                    'pdf_url' => "/public/worksites/{$token}/invoices/{$wi->invoice->id}/pdf",
                ]),
            ],
        ]], 200, self::HEADERS);
    }

    public function photo(string $token, WorksitePhoto $photo): StreamedResponse
    {
        $worksite = $this->find($token);
        abort_unless($photo->worksite_id === $worksite->id && $photo->is_public, 404);

        return Storage::disk('local')->response($photo->path, "photo-{$photo->id}.webp", ['Cache-Control' => 'private, max-age=86400', 'X-Robots-Tag' => 'noindex']);
    }

    public function invoicePdf(string $token, Invoice $invoice, WorksBilling $billing): Response
    {
        $worksite = $this->find($token);
        $belongs = $billing->history($worksite)->contains(fn (WorksiteInvoice $wi) => $wi->invoice_id === $invoice->id);
        abort_unless($belongs && ! $invoice->isDraft(), 404);

        return InvoicePdf::invoice($invoice);
    }

    private function find(string $token): Worksite
    {
        abort_if(strlen($token) < 32, 404);

        return Worksite::query()->where('tracking_token', $token)->firstOrFail();
    }
}
