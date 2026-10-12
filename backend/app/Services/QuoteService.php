<?php

namespace App\Services;

use App\Enums\QuoteStatus;
use App\Models\Quote;
use App\Models\User;
use App\Support\Sequence;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Devis de travaux (lot 3) : saisie par lots, totaux, envoi, décision du client, modèles.
 *
 * Calcul (mêmes règles que les factures, D-031) : montant HT de chaque ligne arrondi au franc ; la
 * remise du devis s'applique ligne par ligne, puis la TVA est calculée sur le montant remisé, arrondie
 * au franc par ligne. Les totaux sont toujours recalculés ici.
 */
class QuoteService
{
    public function __construct(private readonly WorksiteService $worksites) {}

    /**
     * @param  array{quantity: float|int|string, unit_price: int|string, vat_rate?: float|int|string|null}  $line
     * @return array{amount: int, net_amount: int, vat_amount: int}
     */
    public static function computeLine(array $line, float $discountRate): array
    {
        $amount = Billing::computeLine([...$line, 'vat_rate' => 0])['amount'];
        $net = (int) round($amount * (10000 - (int) round($discountRate * 100)) / 10000);
        $rateBasisPoints = (int) round((float) ($line['vat_rate'] ?? 0) * 100);

        return ['amount' => $amount, 'net_amount' => $net, 'vat_amount' => (int) round($net * $rateBasisPoints / 10000)];
    }

    /**
     * Enregistre un brouillon ou un modèle et remplace ses lots et ses lignes.
     *
     * @param  array<string, mixed>  $attributes
     * @param  list<array{title: string, trade_id?: int|null, lines?: list<array<string, mixed>>}>  $lots
     */
    public function save(Quote $quote, array $attributes, array $lots, ?User $by = null): Quote
    {
        if ($quote->exists && ! $quote->isDraft()) {
            throw ValidationException::withMessages(['quote' => 'Un devis envoyé ne se modifie plus : reprenez-le en brouillon ou dupliquez-le.']);
        }

        return DB::transaction(function () use ($quote, $attributes, $lots, $by) {
            $quote->fill($attributes);
            if (! $quote->exists) {
                $quote->created_by ??= $by?->id;
                if (! $quote->is_template) {
                    $quote->number = sprintf('DEV-%d-%04d', now()->year, Sequence::next('devis'));
                }
            }
            $quote->save();

            $quote->lots()->delete();
            $discount = (float) $quote->discount_rate;
            $totals = ['subtotal' => 0, 'net' => 0, 'vat' => 0];
            foreach (array_values($lots) as $lotPosition => $lotData) {
                $lot = $quote->lots()->create([
                    'title' => $lotData['title'],
                    'trade_id' => $lotData['trade_id'] ?? null,
                    'position' => $lotPosition,
                ]);
                $lotNet = 0;
                foreach (array_values($lotData['lines'] ?? []) as $position => $line) {
                    $computed = self::computeLine($line, $discount);
                    $lot->lines()->create([
                        'catalog_item_id' => $line['catalog_item_id'] ?? null,
                        'designation' => $line['designation'],
                        'unit' => $line['unit'] ?? null,
                        'quantity' => $line['quantity'],
                        'unit_price' => (int) $line['unit_price'],
                        'vat_rate' => $line['vat_rate'] ?? 0,
                        'position' => $position,
                        ...$computed,
                    ]);
                    $totals['subtotal'] += $computed['amount'];
                    $totals['net'] += $computed['net_amount'];
                    $totals['vat'] += $computed['vat_amount'];
                    $lotNet += $computed['net_amount'];
                }
                $lot->forceFill(['total_ht' => $lotNet])->save();
            }

            $quote->forceFill([
                'subtotal' => $totals['subtotal'],
                'discount_amount' => $totals['subtotal'] - $totals['net'],
                'total_ht' => $totals['net'],
                'vat_total' => $totals['vat'],
                'total' => $totals['net'] + $totals['vat'],
            ])->save();

            return $quote;
        });
    }

    /**
     * Envoi au client (ou nouvel envoi d'un devis expiré) : date du devis et fin de validité.
     */
    public function send(Quote $quote): Quote
    {
        $this->ensureQuote($quote);
        if (! in_array($quote->status, [QuoteStatus::Brouillon, QuoteStatus::Expire], true)) {
            throw ValidationException::withMessages(['quote' => 'Ce devis a déjà été envoyé.']);
        }
        if ($quote->total <= 0) {
            throw ValidationException::withMessages(['quote' => 'Un devis sans montant ne peut pas être envoyé.']);
        }

        $today = CarbonImmutable::today();
        $quote->forceFill([
            'status' => QuoteStatus::Envoye,
            'issue_date' => $today,
            'valid_until' => $today->addDays((int) config('borom.quote_validity_days')),
            'sent_at' => now(),
        ])->save();

        return $quote;
    }

    /**
     * Le client accepte : le chantier est créé (ou rattaché) avec les lots du devis.
     */
    public function accept(Quote $quote, User $by, ?int $worksiteId = null): Quote
    {
        $this->ensureQuote($quote);
        if ($quote->status !== QuoteStatus::Envoye) {
            throw ValidationException::withMessages(['quote' => $quote->status === QuoteStatus::Expire
                ? 'Ce devis a expiré : renvoyez-le avant de l\'accepter.'
                : 'Seul un devis envoyé peut être accepté.']);
        }

        return DB::transaction(function () use ($quote, $by, $worksiteId) {
            $quote->forceFill(['status' => QuoteStatus::Accepte, 'decided_at' => now()])->save();
            $this->worksites->fromQuote($quote, $by, $worksiteId);

            return $quote;
        });
    }

    public function refuse(Quote $quote, string $reason): Quote
    {
        $this->ensureQuote($quote);
        if (! in_array($quote->status, [QuoteStatus::Envoye, QuoteStatus::Expire], true)) {
            throw ValidationException::withMessages(['quote' => 'Seul un devis envoyé peut être refusé.']);
        }
        $quote->forceFill(['status' => QuoteStatus::Refuse, 'decided_at' => now(), 'refusal_reason' => $reason])->save();

        return $quote;
    }

    /**
     * Reprend un devis envoyé ou expiré en brouillon pour le corriger (il devra être renvoyé).
     */
    public function reopen(Quote $quote): Quote
    {
        $this->ensureQuote($quote);
        if (! in_array($quote->status, [QuoteStatus::Envoye, QuoteStatus::Expire], true)) {
            throw ValidationException::withMessages(['quote' => 'Seul un devis envoyé ou expiré peut être repris en brouillon.']);
        }
        $quote->forceFill(['status' => QuoteStatus::Brouillon, 'issue_date' => null, 'valid_until' => null, 'sent_at' => null])->save();

        return $quote;
    }

    /**
     * Copie un devis ou un modèle : nouveau devis (pour un client) ou nouveau modèle.
     *
     * @param  array<string, mixed>  $overrides
     */
    public function duplicate(Quote $source, array $overrides, User $by): Quote
    {
        $source->loadMissing('lots.lines');
        $asTemplate = (bool) ($overrides['is_template'] ?? false);
        if (! $asTemplate && empty($overrides['client_id'] ?? ($source->is_template ? null : $source->client_id))) {
            throw ValidationException::withMessages(['client_id' => 'Choisissez le client du nouveau devis.']);
        }

        $attributes = [
            'is_template' => $asTemplate,
            'template_name' => $asTemplate ? ($overrides['template_name'] ?? $source->template_name ?? $source->title) : null,
            'client_id' => $asTemplate ? null : ($overrides['client_id'] ?? $source->client_id),
            'property_id' => $asTemplate ? null : ($overrides['property_id'] ?? ($source->is_template ? null : $source->property_id)),
            'title' => $overrides['title'] ?? $source->title,
            'site_address' => $asTemplate ? null : ($overrides['site_address'] ?? ($source->is_template ? null : $source->site_address)),
            'discount_rate' => $source->discount_rate,
            'deposit_rate' => $source->deposit_rate,
            'conditions' => $source->conditions,
        ];
        $lots = $source->lots->map(fn ($lot) => [
            'title' => $lot->title,
            'trade_id' => $lot->trade_id,
            'lines' => $lot->lines->map(fn ($l) => $l->only(['catalog_item_id', 'designation', 'unit', 'quantity', 'unit_price', 'vat_rate']))->all(),
        ])->all();

        return $this->save(new Quote, $attributes, $lots, $by);
    }

    /**
     * Devis envoyés dont la validité est dépassée : « expiré » (tâche planifiée quotidienne).
     */
    public function expireOverdue(?CarbonImmutable $today = null): int
    {
        return Quote::query()->quotes()->where('status', QuoteStatus::Envoye)
            ->whereDate('valid_until', '<', ($today ?? CarbonImmutable::today())->toDateString())
            ->get()
            ->each(fn (Quote $quote) => $quote->forceFill(['status' => QuoteStatus::Expire])->save())
            ->count();
    }

    private function ensureQuote(Quote $quote): void
    {
        if ($quote->is_template) {
            throw ValidationException::withMessages(['quote' => 'Un modèle ne s\'envoie pas : créez d\'abord un devis à partir de lui.']);
        }
    }
}
