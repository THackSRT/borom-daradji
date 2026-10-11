<?php

namespace App\Services;

use App\Enums\Activity;
use App\Enums\PaymentMethod;
use App\Enums\StockMovementType;
use App\Models\Article;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\InvoiceLine;
use App\Models\StockMovement;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Vente de matériaux au comptoir : une facture « matériaux » ordinaire (lot 2), émise aussitôt puisque
 * la marchandise part tout de suite ; le stock diminue au CMUP ; l'encaissement peut suivre dans le même
 * geste (espèces dans la caisse du jour). Le prix de vente est celui de la fiche, modifiable ligne par
 * ligne. Retour de marchandise : rentre en stock au coût de sa sortie, sans dépasser ce qui a été vendu
 * (l'avoir se fait à part, par le comptable).
 */
class CounterSale
{
    public function __construct(private StockService $stock) {}

    /**
     * @param  list<array{article_id: int, quantity: float|int|string, unit_price?: int|null, vat_rate?: float|int|string|null}>  $lines
     * @param  array{method: string, amount: int, reference?: string|null}|null  $payment
     */
    public function sell(Client $client, array $lines, ?array $payment, ?string $notes, User $by): Invoice
    {
        if (! $lines) {
            throw ValidationException::withMessages(['lines' => 'Ajoutez au moins un article.']);
        }
        if ($payment) {
            $method = PaymentMethod::from($payment['method']);
            if ($method === PaymentMethod::Caution) {
                throw ValidationException::withMessages(['payment.method' => 'Mode de paiement invalide.']);
            }
            if ($method->requiresReference() && empty(trim((string) ($payment['reference'] ?? '')))) {
                throw ValidationException::withMessages(['payment.reference' => 'Référence obligatoire pour ce mode (identifiant de transaction, numéro de chèque…).']);
            }
        }

        return DB::transaction(function () use ($client, $lines, $payment, $notes, $by) {
            $articles = Article::query()->whereIn('id', array_column($lines, 'article_id'))->get()->keyBy('id');
            $invoice = Billing::saveDraft(new Invoice([
                'client_id' => $client->id,
                'activity' => Activity::Negoce,
                'notes' => $notes ?: 'Vente au comptoir',
                'created_by' => $by->id,
            ]), [], array_map(fn (array $l) => [
                'article_id' => $l['article_id'],
                'description' => $articles[$l['article_id']]->name,
                'quantity' => round((float) $l['quantity'], 2),
                'unit' => $articles[$l['article_id']]->unit,
                'unit_price' => (int) ($l['unit_price'] ?? $articles[$l['article_id']]->sale_price),
                'vat_rate' => $l['vat_rate'] ?? $articles[$l['article_id']]->vat_rate,
            ], $lines));
            $invoice = Billing::issue($invoice, $by);

            foreach ($invoice->lines as $line) {
                $this->stock->issue($articles[$line->article_id], (float) $line->quantity, StockMovementType::Vente, [
                    'invoice_id' => $invoice->id, 'reason' => "Vente {$invoice->number} — {$client->name}",
                ], $by);
            }
            if ($payment && $payment['amount'] > 0) {
                Billing::recordPayment($invoice, [...$payment, 'paid_on' => today()->toDateString()], $by);
            }

            return $invoice->fresh(['lines', 'client']);
        });
    }

    public function returnGoods(Invoice $invoice, Article $article, float $quantity, ?string $note, User $by): StockMovement
    {
        $sold = StockMovement::query()->where('invoice_id', $invoice->id)->where('article_id', $article->id)
            ->whereIn('type', [StockMovementType::Vente, StockMovementType::RetourVente])
            ->selectRaw('coalesce(sum(quantity), 0) as qty, coalesce(sum(value), 0) as val')->first();
        $out = -(float) $sold->qty;
        if (! InvoiceLine::query()->where('invoice_id', $invoice->id)->where('article_id', $article->id)->exists() || $out <= 0) {
            throw ValidationException::withMessages(['article_id' => 'Cet article n\'a pas été vendu sur cette facture, ou il est déjà revenu.']);
        }
        if (round($quantity, 2) > round($out, 2)) {
            throw ValidationException::withMessages(['quantity' => 'Seulement '.StockService::qty($out)." {$article->unit} vendus sur cette facture."]);
        }

        return $this->stock->receive($article, round($quantity, 2), -(float) $sold->val / $out, StockMovementType::RetourVente, [
            'invoice_id' => $invoice->id, 'reason' => $note ?: "Retour sur {$invoice->number}",
        ], $by);
    }
}
