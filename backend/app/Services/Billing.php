<?php

namespace App\Services;

use App\Enums\InvoiceStatus;
use App\Enums\InvoiceType;
use App\Enums\PaymentMethod;
use App\Models\CashSession;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\User;
use App\Support\Sequence;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Règles de facturation et d'encaissement (lot 2), réutilisées par les travaux et le négoce.
 *
 * - Les totaux sont toujours recalculés ici, jamais repris du navigateur.
 * - Le numéro est attribué à l'émission, dans la même transaction : pas de trou, pas de doublon.
 * - Une facture émise ne change plus ; un avoir la corrige, dans la limite de son montant.
 */
final class Billing
{
    /**
     * Montant HT et TVA d'une ligne, arrondis au franc.
     *
     * @param  array{quantity: float|int|string, unit_price: int|string, vat_rate?: float|int|string|null}  $line
     * @return array{amount: int, vat_amount: int}
     */
    public static function computeLine(array $line): array
    {
        $hundredths = (int) round((float) $line['quantity'] * 100);
        $amount = (int) round($hundredths * (int) $line['unit_price'] / 100);
        $rateBasisPoints = (int) round((float) ($line['vat_rate'] ?? 0) * 100);

        return [
            'amount' => $amount,
            'vat_amount' => (int) round($amount * $rateBasisPoints / 10000),
        ];
    }

    /**
     * Enregistre un brouillon (création ou modification) et remplace ses lignes.
     *
     * @param  array<string, mixed>  $attributes
     * @param  list<array<string, mixed>>  $lines
     */
    public static function saveDraft(Invoice $invoice, array $attributes, array $lines): Invoice
    {
        self::ensureDraft($invoice);

        return DB::transaction(function () use ($invoice, $attributes, $lines) {
            $invoice->fill($attributes);
            $invoice->save();

            $invoice->lines()->delete();
            $subtotal = 0;
            $vat = 0;
            foreach (array_values($lines) as $position => $line) {
                $computed = self::computeLine($line);
                $invoice->lines()->create([
                    'position' => $position,
                    'description' => $line['description'],
                    'quantity' => $line['quantity'],
                    'unit' => $line['unit'] ?? null,
                    'unit_price' => (int) $line['unit_price'],
                    'vat_rate' => $line['vat_rate'] ?? 0,
                    ...$computed,
                ]);
                $subtotal += $computed['amount'];
                $vat += $computed['vat_amount'];
            }

            $invoice->forceFill(['subtotal' => $subtotal, 'vat_total' => $vat, 'total' => $subtotal + $vat])->save();

            return $invoice->load('lines');
        });
    }

    /**
     * Émet la facture ou l'avoir : numéro définitif, date, échéance.
     */
    public static function issue(Invoice $invoice, User $by): Invoice
    {
        self::ensureDraft($invoice);

        if ($invoice->total <= 0) {
            throw ValidationException::withMessages(['invoice' => 'Une facture sans montant ne peut pas être émise.']);
        }

        return DB::transaction(function () use ($invoice, $by) {
            // Relu et verrouillé : deux émissions simultanées ne peuvent pas passer toutes les deux.
            $invoice = Invoice::query()->lockForUpdate()->findOrFail($invoice->id);
            self::ensureDraft($invoice);

            if ($invoice->isCreditNote()) {
                $original = Invoice::query()->lockForUpdate()->findOrFail($invoice->credited_invoice_id);
                $available = $original->total - $original->credited_total;
                if ($invoice->total > $available) {
                    throw ValidationException::withMessages([
                        'invoice' => 'L\'avoir dépasse ce qui reste à créditer sur '.$original->number.' ('.self::money($available).').',
                    ]);
                }
                $original->increment('credited_total', $invoice->total);
            }

            $issueDate = $invoice->issue_date ?? today();
            $year = (int) now()->year;
            $sequence = Sequence::next($invoice->type->value, $year);

            $invoice->forceFill([
                'number' => sprintf('%s-%d-%05d', $invoice->type->prefix(), $year, $sequence),
                'status' => InvoiceStatus::Emise,
                'issue_date' => $issueDate,
                'due_date' => $invoice->isCreditNote()
                    ? null
                    : ($invoice->due_date ?? $issueDate->copy()->addDays((int) config('borom.invoice_due_days'))),
                'issued_at' => now(),
                'issued_by' => $by->id,
            ])->save();

            return $invoice->load('lines');
        });
    }

    /**
     * Prépare un avoir (brouillon) sur une facture émise : toutes ses lignes par défaut, à ajuster.
     */
    public static function prepareCreditNote(Invoice $invoice, User $by): Invoice
    {
        if ($invoice->isDraft() || $invoice->isCreditNote()) {
            throw ValidationException::withMessages(['invoice' => 'Un avoir ne se fait que sur une facture émise.']);
        }

        if ($invoice->total - $invoice->credited_total <= 0) {
            throw ValidationException::withMessages(['invoice' => 'Cette facture est déjà entièrement créditée.']);
        }

        $creditNote = new Invoice([
            'type' => InvoiceType::Avoir,
            'client_id' => $invoice->client_id,
            'property_id' => $invoice->property_id,
            'activity' => $invoice->activity,
            'credited_invoice_id' => $invoice->id,
            'notes' => 'Avoir sur la facture '.$invoice->number,
            'created_by' => $by->id,
        ]);

        $lines = $invoice->lines->map(fn ($line) => $line->only(['description', 'quantity', 'unit', 'unit_price', 'vat_rate']))->all();

        return self::saveDraft($creditNote, [], $lines);
    }

    /**
     * Encaissement d'une facture émise ; les espèces vont dans la caisse du jour de la personne qui reçoit.
     *
     * @param  array{method: string, amount: int|string, paid_on?: string|null, reference?: string|null, note?: string|null}  $data
     */
    public static function recordPayment(Invoice $invoice, array $data, User $by, ?UploadedFile $proof = null): Payment
    {
        if ($invoice->isDraft() || $invoice->isCreditNote()) {
            throw ValidationException::withMessages(['invoice' => 'Seule une facture émise peut être encaissée.']);
        }

        $method = PaymentMethod::from($data['method']);
        $amount = (int) $data['amount'];

        return DB::transaction(function () use ($invoice, $data, $by, $proof, $method, $amount) {
            $invoice = Invoice::query()->lockForUpdate()->findOrFail($invoice->id);
            $balance = $invoice->balance();

            if ($amount > $balance) {
                throw ValidationException::withMessages([
                    'amount' => $balance > 0
                        ? 'Le montant dépasse le reste à payer ('.self::money($balance).').'
                        : 'Cette facture est déjà soldée.',
                ]);
            }

            $reference = isset($data['reference']) ? trim((string) $data['reference']) : null;
            if ($reference && Payment::query()->valid()->where('method', $method)->where('reference', $reference)->exists()) {
                throw ValidationException::withMessages(['reference' => 'Cette référence de transaction est déjà enregistrée : paiement en double ?']);
            }

            $session = null;
            if ($method === PaymentMethod::Especes) {
                $session = self::todaySession($by);
                if ($session->isClosed()) {
                    throw ValidationException::withMessages(['method' => 'Votre caisse du jour est clôturée : impossible d\'y ajouter des espèces.']);
                }
            }

            $payment = Payment::create([
                'number' => sprintf('REC-%d-%05d', now()->year, Sequence::next('recu')),
                'invoice_id' => $invoice->id,
                'client_id' => $invoice->client_id,
                'method' => $method,
                'amount' => $amount,
                'paid_on' => $data['paid_on'] ?? today(),
                'reference' => $reference ?: null,
                'proof_path' => $proof?->store('payment-proofs', 'local'),
                'note' => $data['note'] ?? null,
                'received_by' => $by->id,
                'cash_session_id' => $session?->id,
            ]);

            self::refreshPaidTotal($invoice);

            return $payment;
        });
    }

    /**
     * Annule un encaissement saisi par erreur (motif obligatoire). Impossible si la caisse est clôturée.
     */
    public static function cancelPayment(Payment $payment, string $reason, User $by): Payment
    {
        if ($payment->isCancelled()) {
            throw ValidationException::withMessages(['payment' => 'Cet encaissement est déjà annulé.']);
        }

        if ($payment->cashSession?->isClosed()) {
            throw ValidationException::withMessages(['payment' => 'La caisse du '.$payment->cashSession->date->format('d/m/Y').' est clôturée : l\'encaissement ne peut plus être annulé.']);
        }

        return DB::transaction(function () use ($payment, $reason, $by) {
            $payment->forceFill(['cancelled_at' => now(), 'cancelled_by' => $by->id, 'cancel_reason' => $reason])->save();
            self::refreshPaidTotal($payment->invoice);

            return $payment;
        });
    }

    public static function refreshPaidTotal(Invoice $invoice): void
    {
        $invoice->forceFill(['paid_total' => (int) $invoice->payments()->valid()->sum('amount')])->save();
    }

    public static function todaySession(User $user): CashSession
    {
        $session = CashSession::query()->where('user_id', $user->id)->whereDate('date', today())->first()
            ?? CashSession::create(['user_id' => $user->id, 'date' => today()->toDateString(), 'opening_amount' => 0]);

        // Ouverte d'office : ce n'est pas une création côté API (pas de 201).
        $session->wasRecentlyCreated = false;

        return $session;
    }

    public static function money(int $amount): string
    {
        return number_format($amount, 0, ',', ' ').' FCFA';
    }

    private static function ensureDraft(Invoice $invoice): void
    {
        if ($invoice->exists && ! $invoice->isDraft()) {
            throw ValidationException::withMessages(['invoice' => 'Une facture émise ne se modifie plus : établissez un avoir.']);
        }
    }
}
