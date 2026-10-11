<?php

namespace App\Services;

use App\Enums\PaymentMethod;
use App\Models\User;
use App\Models\Worker;
use App\Models\WorkerPayment;
use App\Models\WorkerTask;
use App\Models\Worksite;
use App\Models\WorksiteAttendance;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Tâcherons sur les chantiers : pointage journalier (au tarif du jour du tâcheron, figé dans la ligne),
 * travaux à la tâche, avances et paiements. Le dû d'un tâcheron = journées pointées + tâches terminées ;
 * son solde = dû − versé (négatif tant qu'une avance n'est pas couverte par du travail).
 */
class WorksiteTeam
{
    public function __construct(private WorksiteCosts $costs, private SiteCash $cash) {}

    /**
     * Pointage d'une journée : une ligne par tâcheron (1 = journée, 0,5 = demi-journée). Un tâcheron déjà
     * pointé ce jour-là sur ce chantier voit sa ligne mise à jour ; une ligne déjà reçue avec le même
     * identifiant (synchronisation hors ligne relancée) n'est pas rejouée.
     *
     * @param  list<array{worker_id: int, days: float, daily_rate?: int|null, note?: string|null, client_uuid?: string|null}>  $entries
     * @return list<WorksiteAttendance>
     */
    public function recordAttendance(Worksite $worksite, string $date, array $entries, User $by): array
    {
        app(WorksiteService::class)->ensureOpen($worksite);
        if ($date > today()->toDateString()) {
            throw ValidationException::withMessages(['worked_on' => 'On ne pointe pas une journée à venir.']);
        }

        $saved = DB::transaction(function () use ($worksite, $date, $entries, $by) {
            $saved = [];
            foreach ($entries as $i => $entry) {
                if (! empty($entry['client_uuid']) && $existing = WorksiteAttendance::query()->where('client_uuid', $entry['client_uuid'])->first()) {
                    $saved[] = $existing;

                    continue;
                }
                $worker = Worker::query()->findOrFail($entry['worker_id']);
                $line = WorksiteAttendance::query()->where(['worksite_id' => $worksite->id, 'worker_id' => $worker->id])->whereDate('worked_on', $date)->first()
                    ?? new WorksiteAttendance(['worksite_id' => $worksite->id, 'worker_id' => $worker->id, 'worked_on' => $date]);
                if (! $line->exists && ! $worker->is_active) {
                    throw ValidationException::withMessages(["entries.{$i}.worker_id" => "{$worker->name} est désactivé."]);
                }
                $rate = $entry['daily_rate'] ?? ($line->exists ? $line->daily_rate : $worker->daily_rate);
                $line->fill([
                    'days' => $entry['days'],
                    'daily_rate' => $rate,
                    'amount' => (int) round($rate * $entry['days']),
                    'note' => $entry['note'] ?? $line->note,
                    'client_uuid' => $line->client_uuid ?? ($entry['client_uuid'] ?? null),
                    'recorded_by' => $by->id,
                ])->save();
                $saved[] = $line;
            }

            return $saved;
        });
        $this->costs->checkAlert($worksite);

        return $saved;
    }

    public function removeAttendance(WorksiteAttendance $attendance): void
    {
        app(WorksiteService::class)->ensureOpen($attendance->worksite);
        $attendance->delete();
    }

    /**
     * @param  array{worker_id: int, description: string, amount: int}  $data
     */
    public function createTask(Worksite $worksite, array $data, User $by): WorkerTask
    {
        app(WorksiteService::class)->ensureOpen($worksite);

        return $worksite->workerTasks()->create([...$data, 'status' => 'en_cours', 'created_by' => $by->id]);
    }

    /**
     * @param  array{description?: string, amount?: int}  $data
     */
    public function updateTask(WorkerTask $task, array $data): WorkerTask
    {
        if ($task->status !== 'en_cours') {
            throw ValidationException::withMessages(['task' => 'Seule une tâche en cours se modifie.']);
        }
        $task->update($data);

        return $task;
    }

    /** Tâche terminée : son montant devient dû au tâcheron (et compte dans le coût du chantier). */
    public function completeTask(WorkerTask $task, ?string $date = null): WorkerTask
    {
        if ($task->status !== 'en_cours') {
            throw ValidationException::withMessages(['task' => 'Cette tâche n\'est pas en cours.']);
        }
        $task->update(['status' => 'terminee', 'completed_on' => $date ?? today()->toDateString()]);
        $this->costs->checkAlert($task->worksite);

        return $task;
    }

    public function cancelTask(WorkerTask $task): WorkerTask
    {
        if ($task->status !== 'en_cours') {
            throw ValidationException::withMessages(['task' => 'Une tâche terminée ne s\'annule pas : elle est due au tâcheron.']);
        }
        $task->update(['status' => 'annulee']);

        return $task;
    }

    /**
     * Avance (avant le travail) ou paiement (du travail fait). Un paiement ne dépasse pas le reste dû :
     * au-delà, c'est une avance. Payé avec la caisse du chantier (`from_site_cash`, espèces) : la sortie y
     * est inscrite.
     *
     * @param  array{kind: string, amount: int, paid_on?: string|null, method: string, reference?: string|null, note?: string|null, worksite_id?: int|null, from_site_cash?: bool}  $data
     */
    public function pay(Worker $worker, array $data, User $by): WorkerPayment
    {
        $method = PaymentMethod::from($data['method']);
        $reference = isset($data['reference']) ? trim((string) $data['reference']) : null;
        if ($method === PaymentMethod::Caution) {
            throw ValidationException::withMessages(['method' => 'Mode de paiement invalide.']);
        }
        if ($method->requiresReference() && ! $reference) {
            throw ValidationException::withMessages(['reference' => 'Référence obligatoire pour ce mode (identifiant de transaction, numéro de chèque…).']);
        }
        if ($data['kind'] === 'paiement' && $data['amount'] > $worker->balance()) {
            throw ValidationException::withMessages(['amount' => 'Reste dû à '.$worker->name.' : '.Billing::money(max(0, $worker->balance())).'. Au-delà, enregistrez une avance.']);
        }
        $worksite = ! empty($data['worksite_id']) ? Worksite::query()->findOrFail($data['worksite_id']) : null;
        if (! empty($data['from_site_cash'])) {
            if (! $worksite) {
                throw ValidationException::withMessages(['worksite_id' => 'Indiquez la caisse de quel chantier paie.']);
            }
            if ($method !== PaymentMethod::Especes) {
                throw ValidationException::withMessages(['method' => 'La caisse du chantier paie en espèces.']);
            }
            app(WorksiteService::class)->ensureOpen($worksite);
        }

        return DB::transaction(function () use ($worker, $data, $by, $method, $reference, $worksite) {
            $label = ($data['kind'] === 'avance' ? 'Avance' : 'Paiement')." — {$worker->name}";
            $entry = null;
            if (! empty($data['from_site_cash'])) {
                $entry = $worksite->cashEntries()->create([
                    'kind' => 'paiement_tacheron',
                    'amount' => $data['amount'],
                    'label' => $label,
                    'spent_on' => $data['paid_on'] ?? today()->toDateString(),
                    'holder_id' => $worksite->manager_id,
                    'created_by' => $by->id,
                ]);
            }

            return $worker->payments()->create([
                'worksite_id' => $worksite?->id,
                'kind' => $data['kind'],
                'amount' => $data['amount'],
                'paid_on' => $data['paid_on'] ?? today()->toDateString(),
                'method' => $method,
                'reference' => $reference ?: null,
                'note' => $data['note'] ?? null,
                'site_cash_entry_id' => $entry?->id,
                'paid_by' => $by->id,
            ]);
        });
    }

    public function cancelPayment(WorkerPayment $payment, string $reason, User $by): WorkerPayment
    {
        if ($payment->isCancelled()) {
            throw ValidationException::withMessages(['payment' => 'Ce paiement est déjà annulé.']);
        }

        return DB::transaction(function () use ($payment, $reason, $by) {
            if ($payment->siteCashEntry) {
                $this->cash->cancel($payment->siteCashEntry, $reason, $by, true);
            }
            $payment->forceFill(['cancelled_at' => now(), 'cancelled_by' => $by->id, 'cancel_reason' => $reason])->save();

            return $payment;
        });
    }

    /**
     * Situation de chaque tâcheron sur un chantier (journées, dû, versé).
     *
     * @return list<array<string, mixed>>
     */
    public function crew(Worksite $worksite): array
    {
        $ids = WorksiteAttendance::query()->where('worksite_id', $worksite->id)->distinct()->pluck('worker_id')
            ->merge(WorkerTask::query()->where('worksite_id', $worksite->id)->distinct()->pluck('worker_id'))
            ->merge(WorkerPayment::query()->where('worksite_id', $worksite->id)->distinct()->pluck('worker_id'))
            ->unique();

        return Worker::query()->with('trade')->whereIn('id', $ids)->orderBy('name')->get()
            ->map(fn (Worker $w) => [
                'worker' => ['id' => $w->id, 'name' => $w->name, 'phone' => $w->phone, 'trade' => $w->trade?->name, 'pay_type' => $w->pay_type, 'daily_rate' => $w->daily_rate, 'is_active' => $w->is_active],
                'days' => (float) $w->attendances()->where('worksite_id', $worksite->id)->sum('days'),
                'earned' => $w->earned($worksite->id),
                'paid' => $w->paid($worksite->id),
                'balance' => $w->balance(),
            ])->all();
    }
}
