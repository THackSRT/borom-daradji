<?php

namespace App\Services;

use App\Enums\CashMovementType;
use App\Enums\ClientCategory;
use App\Enums\PaymentMethod;
use App\Enums\StockMovementType;
use App\Models\Article;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Purchase;
use App\Models\SupplierPayment;
use App\Models\User;
use App\Support\Sequence;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Achats aux fournisseurs : la marchandise reçue entre en stock au prix d'achat HT (le CMUP se
 * recalcule), le prix d'achat de l'article devient le dernier payé. Paiements partiels possibles ; en
 * espèces, ils sortent de la caisse du jour.
 */
class PurchaseService
{
    public function __construct(private StockService $stock) {}

    /**
     * @param  array{supplier_id: int, supplier_reference?: string|null, received_on?: string|null, due_date?: string|null, notes?: string|null}  $data
     * @param  list<array{article_id: int, quantity: float|int|string, unit_cost: int, vat_rate?: float|int|string|null}>  $lines
     */
    public function record(array $data, array $lines, User $by): Purchase
    {
        if (! $lines) {
            throw ValidationException::withMessages(['lines' => 'Ajoutez au moins un article.']);
        }

        return DB::transaction(function () use ($data, $lines, $by) {
            $receivedOn = $data['received_on'] ?? today()->toDateString();
            $purchase = new Purchase([
                ...$data,
                'received_on' => $receivedOn,
                'due_date' => $data['due_date'] ?? now()->parse($receivedOn)->addDays((int) config('borom.purchase_due_days'))->toDateString(),
                'created_by' => $by->id,
            ]);
            $purchase->number = sprintf('ACH-%d-%04d', now()->year, Sequence::next('achat'));
            $purchase->save();

            $subtotal = 0;
            $vat = 0;
            foreach ($lines as $line) {
                $article = Article::query()->findOrFail($line['article_id']);
                $quantity = round((float) $line['quantity'], 2);
                $rate = (float) ($line['vat_rate'] ?? $article->vat_rate);
                $amount = (int) round($quantity * (int) $line['unit_cost']);
                $lineVat = (int) round($amount * (int) round($rate * 100) / 10000);
                $purchase->lines()->create([
                    'article_id' => $article->id, 'quantity' => $quantity, 'unit_cost' => (int) $line['unit_cost'],
                    'vat_rate' => $rate, 'amount' => $amount, 'vat_amount' => $lineVat,
                ]);
                $this->stock->receive($article, $quantity, (int) $line['unit_cost'], StockMovementType::Achat, [
                    'moved_on' => $receivedOn, 'purchase_id' => $purchase->id, 'reason' => $purchase->number,
                ], $by);
                $article->forceFill([
                    'purchase_price' => (int) $line['unit_cost'],
                    'supplier_id' => $article->supplier_id ?? $purchase->supplier_id,
                ])->save();
                $subtotal += $amount;
                $vat += $lineVat;
            }
            $purchase->forceFill(['subtotal' => $subtotal, 'vat_total' => $vat, 'total' => $subtotal + $vat])->save();

            $supplier = Client::query()->findOrFail($purchase->supplier_id);
            if (! in_array(ClientCategory::Fournisseur, $supplier->categories->all(), true)) {
                $supplier->update(['categories' => [...$supplier->categories->all(), ClientCategory::Fournisseur]]);
            }

            return $purchase;
        });
    }

    /**
     * @param  array{amount: int, method: string, paid_on?: string|null, reference?: string|null, note?: string|null}  $data
     */
    public function pay(Purchase $purchase, array $data, User $by): SupplierPayment
    {
        if ($purchase->isCancelled()) {
            throw ValidationException::withMessages(['purchase' => 'Cet achat est annulé.']);
        }
        if ($data['amount'] > $purchase->balance()) {
            throw ValidationException::withMessages(['amount' => 'Reste à payer : '.Billing::money($purchase->balance()).'.']);
        }
        $method = PaymentMethod::from($data['method']);
        $reference = isset($data['reference']) ? trim((string) $data['reference']) : null;
        if ($method === PaymentMethod::Caution) {
            throw ValidationException::withMessages(['method' => 'Mode de paiement invalide.']);
        }
        if ($method->requiresReference() && ! $reference) {
            throw ValidationException::withMessages(['reference' => 'Référence obligatoire pour ce mode (identifiant de transaction, numéro de chèque…).']);
        }

        return DB::transaction(function () use ($purchase, $data, $by, $method, $reference) {
            $movement = null;
            if ($method === PaymentMethod::Especes) {
                if (! $by->can('useCash', Invoice::class)) {
                    throw ValidationException::withMessages(['method' => 'Vous ne tenez pas de caisse : choisissez un autre mode, ou faites payer par la personne qui tient la caisse.']);
                }
                $session = Billing::todaySession($by);
                if ($session->isClosed()) {
                    throw ValidationException::withMessages(['method' => 'Votre caisse du jour est clôturée : impossible d\'en sortir des espèces.']);
                }
                if ($data['amount'] > $session->expected()) {
                    throw ValidationException::withMessages(['amount' => 'Il n\'y a que '.Billing::money($session->expected()).' dans votre caisse.']);
                }
                $movement = $session->movements()->create([
                    'type' => CashMovementType::PaiementFournisseur,
                    'amount' => $data['amount'],
                    'label' => "Achat {$purchase->number} — {$purchase->supplier->name}",
                    'created_by' => $by->id,
                ]);
            }
            $payment = $purchase->payments()->create([
                'amount' => $data['amount'],
                'paid_on' => $data['paid_on'] ?? today()->toDateString(),
                'method' => $method,
                'reference' => $reference ?: null,
                'note' => $data['note'] ?? null,
                'cash_movement_id' => $movement?->id,
                'paid_by' => $by->id,
            ]);
            $this->refreshPaid($purchase);

            return $payment;
        });
    }

    public function cancelPayment(SupplierPayment $payment, string $reason, User $by): SupplierPayment
    {
        if ($payment->isCancelled()) {
            throw ValidationException::withMessages(['payment' => 'Ce paiement est déjà annulé.']);
        }
        $session = $payment->cashMovement?->session;
        if ($session?->isClosed()) {
            throw ValidationException::withMessages(['payment' => 'La caisse du '.$session->date->format('d/m/Y').' est clôturée : ce paiement en espèces ne peut plus être annulé.']);
        }

        return DB::transaction(function () use ($payment, $reason, $by, $session) {
            if ($session && $payment->cashMovement) {
                $session->movements()->create([
                    'type' => CashMovementType::RetourFournisseur,
                    'amount' => $payment->amount,
                    'label' => "Annulation : {$payment->cashMovement->label}",
                    'created_by' => $by->id,
                ]);
            }
            $payment->forceFill(['cancelled_at' => now(), 'cancelled_by' => $by->id, 'cancel_reason' => $reason])->save();
            $this->refreshPaid($payment->purchase);

            return $payment;
        });
    }

    /**
     * Annulation d'un achat saisi par erreur : la marchandise ressort du stock à son prix d'achat.
     * Refusée s'il reste des paiements valides ou si la marchandise est déjà sortie.
     */
    public function cancel(Purchase $purchase, string $reason, User $by): Purchase
    {
        if ($purchase->isCancelled()) {
            throw ValidationException::withMessages(['purchase' => 'Cet achat est déjà annulé.']);
        }
        if ($purchase->payments()->whereNull('cancelled_at')->exists()) {
            throw ValidationException::withMessages(['purchase' => 'Annulez d\'abord les paiements de cet achat.']);
        }

        return DB::transaction(function () use ($purchase, $reason, $by) {
            foreach ($purchase->lines()->with('article')->get() as $line) {
                $this->stock->reverseEntry($line->article, $line->quantity, $line->unit_cost, StockMovementType::AnnulationAchat, [
                    'purchase_id' => $purchase->id, 'reason' => "Annulation {$purchase->number} : {$reason}",
                ], $by);
            }
            $purchase->forceFill(['cancelled_at' => now(), 'cancelled_by' => $by->id, 'cancel_reason' => $reason])->save();

            return $purchase;
        });
    }

    private function refreshPaid(Purchase $purchase): void
    {
        $purchase->forceFill(['paid_total' => (int) $purchase->payments()->whereNull('cancelled_at')->sum('amount')])->save();
    }
}
