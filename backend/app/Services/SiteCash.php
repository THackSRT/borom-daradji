<?php

namespace App\Services;

use App\Enums\CashMovementType;
use App\Models\CashMovement;
use App\Models\CashSession;
use App\Models\SiteCashEntry;
use App\Models\User;
use App\Models\Worksite;
use App\Support\ImageOptimizer;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Caisse de chantier, tenue par le chef de chantier : l'agence l'approvisionne (éventuellement depuis la
 * caisse du jour, en espèces), il dépense sur place avec photo du reçu et paie des tâcherons, puis rend
 * le reliquat. Le solde peut devenir négatif : le chef a avancé de sa poche, l'agence le rembourse par un
 * approvisionnement (une dépense saisie hors ligne n'est jamais refusée faute de solde).
 */
class SiteCash
{
    public function __construct(private WorksiteCosts $costs) {}

    public function balance(Worksite $worksite): int
    {
        return (int) SiteCashEntry::query()->valid()->where('worksite_id', $worksite->id)
            ->selectRaw("sum(case when kind = 'approvisionnement' then amount else -amount end) as balance")
            ->value('balance');
    }

    /**
     * @return array<string, int>
     */
    public function totals(Worksite $worksite): array
    {
        $byKind = SiteCashEntry::query()->valid()->where('worksite_id', $worksite->id)
            ->selectRaw('kind, sum(amount) as total')->groupBy('kind')->pluck('total', 'kind');

        return [
            ...collect(array_keys(SiteCashEntry::KINDS))->mapWithKeys(fn (string $k) => [$k => (int) ($byKind[$k] ?? 0)])->all(),
            'balance' => $this->balance($worksite),
            'missing_receipts' => SiteCashEntry::query()->valid()->where('worksite_id', $worksite->id)
                ->where('kind', 'depense')->whereNull('receipt_path')->count(),
        ];
    }

    /**
     * Argent remis au chef de chantier. Pris dans la caisse du jour de l'agence si `from_cash_register`
     * (sortie d'espèces inscrite), sinon versé autrement (Wave, banque…).
     *
     * @param  array{amount: int, spent_on?: string|null, label?: string|null, holder_id?: int|null, from_cash_register?: bool}  $data
     */
    public function supply(Worksite $worksite, array $data, User $by): SiteCashEntry
    {
        app(WorksiteService::class)->ensureOpen($worksite);

        return DB::transaction(function () use ($worksite, $data, $by) {
            $holder = $data['holder_id'] ?? $worksite->manager_id;
            $label = trim((string) ($data['label'] ?? '')) ?: 'Approvisionnement de la caisse du chantier';
            $movement = null;
            if (! empty($data['from_cash_register'])) {
                $session = $this->openSession($by, $data['amount']);
                $movement = $session->movements()->create([
                    'type' => CashMovementType::AvanceChantier,
                    'amount' => $data['amount'],
                    'label' => "Avance chantier {$worksite->reference}".($holder ? ' — '.User::find($holder)?->name : ''),
                    'created_by' => $by->id,
                ]);
            }

            return $worksite->cashEntries()->create([
                'kind' => 'approvisionnement',
                'amount' => $data['amount'],
                'label' => $label,
                'spent_on' => $data['spent_on'] ?? today()->toDateString(),
                'holder_id' => $holder,
                'cash_movement_id' => $movement?->id,
                'created_by' => $by->id,
            ]);
        });
    }

    /**
     * Reliquat rendu à l'agence, éventuellement remis dans la caisse du jour (entrée d'espèces).
     *
     * @param  array{amount: int, spent_on?: string|null, label?: string|null, to_cash_register?: bool}  $data
     */
    public function giveBack(Worksite $worksite, array $data, User $by): SiteCashEntry
    {
        if ($data['amount'] > $this->balance($worksite)) {
            throw ValidationException::withMessages(['amount' => 'La caisse du chantier ne contient que '.Billing::money(max(0, $this->balance($worksite))).'.']);
        }

        return DB::transaction(function () use ($worksite, $data, $by) {
            $movement = null;
            if (! empty($data['to_cash_register'])) {
                $session = $this->openSession($by);
                $movement = $session->movements()->create([
                    'type' => CashMovementType::RetourChantier,
                    'amount' => $data['amount'],
                    'label' => "Retour caisse chantier {$worksite->reference}",
                    'created_by' => $by->id,
                ]);
            }

            return $worksite->cashEntries()->create([
                'kind' => 'retour',
                'amount' => $data['amount'],
                'label' => trim((string) ($data['label'] ?? '')) ?: 'Reliquat rendu à l\'agence',
                'spent_on' => $data['spent_on'] ?? today()->toDateString(),
                'holder_id' => $worksite->manager_id,
                'cash_movement_id' => $movement?->id,
                'created_by' => $by->id,
            ]);
        });
    }

    /**
     * Dépense sur place. Une dépense déjà reçue avec le même identifiant (synchronisation hors ligne
     * relancée) n'est pas enregistrée deux fois.
     *
     * @param  array{category: string, amount: int, label: string, spent_on?: string|null, client_uuid?: string|null}  $data
     */
    public function spend(Worksite $worksite, array $data, ?UploadedFile $receipt, User $by): SiteCashEntry
    {
        if (! empty($data['client_uuid']) && $existing = SiteCashEntry::query()->where('client_uuid', $data['client_uuid'])->first()) {
            return $existing;
        }
        app(WorksiteService::class)->ensureOpen($worksite);

        $entry = $worksite->cashEntries()->create([
            'kind' => 'depense',
            'category' => $data['category'],
            'amount' => $data['amount'],
            'label' => $data['label'],
            'spent_on' => $data['spent_on'] ?? today()->toDateString(),
            'receipt_path' => $receipt ? ImageOptimizer::storeAsWebp($receipt, "worksites/{$worksite->id}/receipts", 'local') : null,
            'holder_id' => $worksite->manager_id,
            'client_uuid' => $data['client_uuid'] ?? null,
            'created_by' => $by->id,
        ]);
        $this->costs->checkAlert($worksite);

        return $entry;
    }

    public function attachReceipt(SiteCashEntry $entry, UploadedFile $receipt): SiteCashEntry
    {
        if ($entry->kind !== 'depense' || $entry->isCancelled()) {
            throw ValidationException::withMessages(['receipt' => 'Seule une dépense valide reçoit un reçu.']);
        }
        $entry->update(['receipt_path' => ImageOptimizer::storeAsWebp($receipt, "worksites/{$entry->worksite_id}/receipts", 'local')]);

        return $entry;
    }

    /**
     * Annulation avec motif (jamais de suppression). Les espèces sorties de la caisse du jour, ou
     * rentrées, y font le chemin inverse, tant que cette caisse n'est pas clôturée.
     */
    public function cancel(SiteCashEntry $entry, string $reason, User $by, bool $fromWorkerPayment = false): SiteCashEntry
    {
        if ($entry->isCancelled()) {
            throw ValidationException::withMessages(['entry' => 'Ce mouvement est déjà annulé.']);
        }
        if ($entry->kind === 'paiement_tacheron' && ! $fromWorkerPayment) {
            throw ValidationException::withMessages(['entry' => 'Annulez le paiement depuis la fiche du tâcheron.']);
        }
        $movement = $entry->cash_movement_id ? CashMovement::with('session')->find($entry->cash_movement_id) : null;
        if ($movement?->session?->isClosed()) {
            throw ValidationException::withMessages(['entry' => 'La caisse du '.$movement->session->date->format('d/m/Y').' est clôturée : ce mouvement ne peut plus être annulé.']);
        }

        return DB::transaction(function () use ($entry, $reason, $by, $movement) {
            if ($movement) {
                $movement->session->movements()->create([
                    'type' => $movement->type === CashMovementType::AvanceChantier ? CashMovementType::RetourChantier : CashMovementType::AvanceChantier,
                    'amount' => $movement->amount,
                    'label' => "Annulation : {$movement->label}",
                    'created_by' => $by->id,
                ]);
            }
            $entry->forceFill(['cancelled_at' => now(), 'cancelled_by' => $by->id, 'cancel_reason' => $reason])->save();

            return $entry;
        });
    }

    private function openSession(User $by, ?int $outgoing = null): CashSession
    {
        $session = Billing::todaySession($by);
        if ($session->isClosed()) {
            throw ValidationException::withMessages(['from_cash_register' => 'Votre caisse du jour est clôturée.']);
        }
        if ($outgoing !== null && $outgoing > $session->expected()) {
            throw ValidationException::withMessages(['from_cash_register' => 'Il n\'y a que '.Billing::money($session->expected()).' dans votre caisse.']);
        }

        return $session;
    }
}
