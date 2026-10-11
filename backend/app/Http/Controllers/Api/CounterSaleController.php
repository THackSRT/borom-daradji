<?php

namespace App\Http\Controllers\Api;

use App\Enums\PaymentMethod;
use App\Http\Controllers\Controller;
use App\Http\Resources\StockMovementResource;
use App\Models\Article;
use App\Models\Client;
use App\Models\Invoice;
use App\Rules\SenegalPhone;
use App\Services\CounterSale;
use App\Support\PhoneNumber;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Vente au comptoir (« stock.sell ») : facture émise et stock déduit en un geste ; encaissement immédiat
 * possible (« payments.create »). Client existant, ou créé à la volée (nom, téléphone facultatif).
 */
class CounterSaleController extends Controller
{
    public function __construct(private readonly CounterSale $sales) {}

    public function store(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasPermission('stock.sell'), 403);
        if ($request->filled('new_client.phone')) {
            $request->merge(['new_client' => [...$request->input('new_client'), 'phone' => PhoneNumber::normalize($request->input('new_client.phone')) ?? $request->input('new_client.phone')]]);
        }
        $data = $request->validate([
            'client_id' => ['required_without:new_client', 'nullable', 'integer', 'exists:clients,id'],
            'new_client' => ['required_without:client_id', 'nullable', 'array'],
            'new_client.name' => ['required_with:new_client', 'string', 'max:160'],
            'new_client.phone' => ['nullable', new SenegalPhone],
            'notes' => ['nullable', 'string', 'max:500'],
            'lines' => ['required', 'array', 'min:1', 'max:100'],
            'lines.*.article_id' => ['required', 'integer', 'distinct', Rule::exists('articles', 'id')->where('is_active', true)],
            'lines.*.quantity' => ['required', 'numeric', 'gt:0'],
            'lines.*.unit_price' => ['nullable', 'integer', 'min:0'],
            'lines.*.vat_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'payment' => ['nullable', 'array'],
            'payment.amount' => ['required_with:payment', 'integer', 'min:0'],
            'payment.method' => ['required_with:payment', Rule::enum(PaymentMethod::class)->only(PaymentMethod::manual())],
            'payment.reference' => ['nullable', 'string', 'max:100'],
        ], [], [
            'client_id' => 'client', 'new_client' => 'client', 'new_client.name' => 'nom du client', 'new_client.phone' => 'téléphone',
            'lines' => 'articles', 'lines.*.article_id' => 'article', 'lines.*.quantity' => 'quantité', 'lines.*.unit_price' => 'prix',
            'payment.amount' => 'montant encaissé', 'payment.method' => 'mode de paiement',
        ]);
        if (! empty($data['payment']['amount'])) {
            abort_unless($request->user()->hasPermission('payments.create'), 403, 'Vous ne pouvez pas encaisser : la vente doit être encaissée par une autre personne.');
        }

        $client = isset($data['client_id']) ? Client::findOrFail($data['client_id']) : $this->clientFrom($data['new_client']);
        $invoice = $this->sales->sell($client, $data['lines'], ! empty($data['payment']['amount']) ? $data['payment'] : null, $data['notes'] ?? null, $request->user());

        return response()->json(['data' => [
            'id' => $invoice->id,
            'number' => $invoice->number,
            'client' => ['id' => $client->id, 'name' => $client->name],
            'total' => $invoice->total,
            'paid_total' => $invoice->paid_total,
            'balance' => $invoice->balance(),
        ]], 201);
    }

    /** Retour de marchandise vendue : rentre en stock (l'avoir se fait à part). */
    public function returnGoods(Request $request, Invoice $invoice): JsonResponse
    {
        abort_unless($request->user()->hasPermission('stock.sell'), 403);
        $data = $request->validate([
            'article_id' => ['required', 'integer', 'exists:articles,id'],
            'quantity' => ['required', 'numeric', 'gt:0'],
            'note' => ['nullable', 'string', 'max:255'],
        ], [], ['article_id' => 'article', 'quantity' => 'quantité']);
        $movement = $this->sales->returnGoods($invoice, Article::findOrFail($data['article_id']), (float) $data['quantity'], $data['note'] ?? null, $request->user());

        return response()->json(['data' => (new StockMovementResource($movement->load('article')))->toArray($request)], 201);
    }

    /**
     * @param  array{name: string, phone?: string|null}  $data
     */
    private function clientFrom(array $data): Client
    {
        if (! empty($data['phone'])) {
            $existing = Client::withTrashed()->where('phone', $data['phone'])->first();
            if ($existing?->trashed()) {
                throw ValidationException::withMessages(['new_client.phone' => "Ce numéro appartient à un client archivé : {$existing->name}."]);
            }
            if ($existing) {
                return $existing;
            }
        }

        return Client::create(['name' => $data['name'], 'phone' => $data['phone'] ?? null, 'categories' => [], 'source' => 'agence']);
    }
}
