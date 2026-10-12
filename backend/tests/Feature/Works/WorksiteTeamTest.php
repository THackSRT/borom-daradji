<?php

namespace Tests\Feature\Works;

use App\Enums\Role;
use App\Enums\WorksiteStatus;
use App\Models\Client;
use App\Models\Task;
use App\Models\User;
use App\Models\Worker;
use App\Models\Worksite;
use App\Services\WorksiteService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WorksiteTeamTest extends TestCase
{
    use RefreshDatabase;

    private User $manager;

    private Worksite $worksite;

    private Worker $mason;

    private Worker $tiler;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-10-12');
        User::factory()->dirigeant()->create();
        $this->manager = User::factory()->withRoles(Role::ResponsableTravaux)->create(['name' => 'Ibou Faye']);
        Sanctum::actingAs($this->manager);

        $service = app(WorksiteService::class);
        $this->worksite = $service->create(['client_id' => Client::factory()->create()->id, 'title' => 'Villa Ngor', 'manager_id' => $this->manager->id], $this->manager);
        $this->worksite->forceFill(['status' => WorksiteStatus::EnCours])->save();

        $this->mason = Worker::find($this->postJson('/api/workers', ['name' => 'Modou Sarr', 'phone' => '77 111 22 33', 'pay_type' => 'journalier', 'daily_rate' => 8_000])->assertCreated()->json('data.id'));
        $this->tiler = Worker::find($this->postJson('/api/workers', ['name' => 'Pape Ndiaye', 'pay_type' => 'tache'])->assertCreated()->json('data.id'));
    }

    public function test_a_worker_phone_is_normalized_and_unique(): void
    {
        $this->assertSame('+221771112233', $this->mason->phone);
        $this->postJson('/api/workers', ['name' => 'Autre', 'phone' => '+221 77 111 22 33', 'pay_type' => 'journalier'])->assertJsonValidationErrors('phone');
    }

    public function test_daily_attendance_uses_the_worker_rate_and_updates_the_same_day(): void
    {
        $this->postJson("/api/worksites/{$this->worksite->id}/attendances", [
            'worked_on' => '2026-10-12',
            'entries' => [['worker_id' => $this->mason->id, 'days' => 1]],
        ])->assertCreated()->assertJsonPath('data.0.amount', 8_000);

        // Le tarif change ensuite : les journées déjà pointées gardent l'ancien.
        $this->putJson("/api/workers/{$this->mason->id}", ['daily_rate' => 9_000])->assertOk();
        $this->postJson("/api/worksites/{$this->worksite->id}/attendances", [
            'worked_on' => '2026-10-12',
            'entries' => [['worker_id' => $this->mason->id, 'days' => 0.5]],
        ])->assertCreated()->assertJsonPath('data.0.amount', 4_000);
        $this->postJson("/api/worksites/{$this->worksite->id}/attendances", [
            'worked_on' => '2026-10-11',
            'entries' => [['worker_id' => $this->mason->id, 'days' => 1]],
        ])->assertCreated()->assertJsonPath('data.0.amount', 9_000);

        $this->assertSame(2, $this->worksite->attendances()->count());
        $this->getJson("/api/worksites/{$this->worksite->id}/team?date=2026-10-12")
            ->assertOk()
            ->assertJsonCount(1, 'data.attendances')
            ->assertJsonPath('data.crew.0.days', 1.5)
            ->assertJsonPath('data.crew.0.earned', 13_000);
    }

    public function test_attendance_is_not_replayed_by_an_offline_sync_and_not_in_the_future(): void
    {
        $uuid = (string) Str::uuid();
        $payload = ['worked_on' => '2026-10-12', 'entries' => [['worker_id' => $this->mason->id, 'days' => 1, 'client_uuid' => $uuid]]];
        $this->postJson("/api/worksites/{$this->worksite->id}/attendances", $payload)->assertCreated();
        $this->postJson("/api/worksites/{$this->worksite->id}/attendances", $payload)->assertCreated();
        $this->assertSame(1, $this->worksite->attendances()->count());

        $this->postJson("/api/worksites/{$this->worksite->id}/attendances", ['worked_on' => '2026-10-13', 'entries' => [['worker_id' => $this->mason->id, 'days' => 1]]])
            ->assertJsonValidationErrors('worked_on');
        $this->postJson("/api/worksites/{$this->worksite->id}/attendances", ['worked_on' => '2026-10-12', 'entries' => [['worker_id' => $this->mason->id, 'days' => 2]]])
            ->assertJsonValidationErrors('entries.0.days');
    }

    public function test_a_closed_worksite_takes_no_more_attendance(): void
    {
        $this->worksite->forceFill(['status' => WorksiteStatus::Termine])->save();

        $this->postJson("/api/worksites/{$this->worksite->id}/attendances", ['worked_on' => '2026-10-12', 'entries' => [['worker_id' => $this->mason->id, 'days' => 1]]])
            ->assertJsonValidationErrors('worksite');
    }

    public function test_a_task_is_owed_once_done_and_an_advance_is_deducted(): void
    {
        $task = $this->postJson("/api/worksites/{$this->worksite->id}/tasks", ['worker_id' => $this->tiler->id, 'description' => 'Carrelage cuisine', 'amount' => 150_000])
            ->assertCreated()->json('data.id');

        // Avance avant le travail : solde négatif.
        $this->postJson("/api/workers/{$this->tiler->id}/payments", ['kind' => 'avance', 'amount' => 50_000, 'method' => 'especes', 'worksite_id' => $this->worksite->id])
            ->assertCreated();
        $this->getJson("/api/workers/{$this->tiler->id}")->assertJsonPath('data.balance', -50_000);

        // Pas de « paiement » au-delà du dû.
        $this->postJson("/api/workers/{$this->tiler->id}/payments", ['kind' => 'paiement', 'amount' => 10_000, 'method' => 'especes'])
            ->assertJsonValidationErrors('amount');

        $this->putJson("/api/worksites/{$this->worksite->id}/tasks/{$task}", ['action' => 'terminer'])->assertOk()->assertJsonPath('data.status.value', 'terminee');
        $this->getJson("/api/workers/{$this->tiler->id}")->assertJsonPath('data.balance', 100_000)->assertJsonPath('data.worksites.0.earned', 150_000);

        $this->postJson("/api/workers/{$this->tiler->id}/payments", ['kind' => 'paiement', 'amount' => 100_000, 'method' => 'wave'])
            ->assertJsonValidationErrors('reference');
        $this->postJson("/api/workers/{$this->tiler->id}/payments", ['kind' => 'paiement', 'amount' => 100_000, 'method' => 'wave', 'reference' => 'W-123'])
            ->assertCreated();
        $this->getJson("/api/workers/{$this->tiler->id}")->assertJsonPath('data.balance', 0)->assertJsonCount(2, 'data.payments');

        // Une tâche terminée ne s'annule plus.
        $this->putJson("/api/worksites/{$this->worksite->id}/tasks/{$task}", ['action' => 'annuler'])->assertJsonValidationErrors('task');
    }

    public function test_paying_from_the_site_cash_records_the_outflow_and_cancelling_reverses_it(): void
    {
        $this->postJson("/api/worksites/{$this->worksite->id}/cash", ['kind' => 'approvisionnement', 'amount' => 100_000])->assertCreated();
        $payment = $this->postJson("/api/workers/{$this->mason->id}/payments", [
            'kind' => 'avance', 'amount' => 20_000, 'method' => 'especes', 'worksite_id' => $this->worksite->id, 'from_site_cash' => true,
        ])->assertCreated()->assertJsonPath('data.from_site_cash', true)->json('data.id');

        $this->getJson("/api/worksites/{$this->worksite->id}/cash")
            ->assertJsonPath('data.totals.balance', 80_000)
            ->assertJsonPath('data.totals.paiement_tacheron', 20_000);
        // Un paiement de tâcheron ne s'annule pas depuis la caisse…
        $entry = $this->worksite->cashEntries()->where('kind', 'paiement_tacheron')->value('id');
        $this->postJson("/api/worksites/{$this->worksite->id}/cash/{$entry}/cancel", ['reason' => 'Erreur'])->assertJsonValidationErrors('entry');
        // … mais depuis la fiche du tâcheron, qui annule aussi la sortie de caisse.
        $this->postJson("/api/workers/{$this->mason->id}/payments/{$payment}/cancel", ['reason' => 'Erreur de saisie'])->assertOk();
        $this->getJson("/api/worksites/{$this->worksite->id}/cash")->assertJsonPath('data.totals.balance', 100_000);

        // La caisse du chantier paie en espèces.
        $this->postJson("/api/workers/{$this->mason->id}/payments", [
            'kind' => 'avance', 'amount' => 5_000, 'method' => 'wave', 'reference' => 'X', 'worksite_id' => $this->worksite->id, 'from_site_cash' => true,
        ])->assertJsonValidationErrors('method');
    }

    public function test_permissions_on_team_and_payments(): void
    {
        // Commercial : voit les tâcherons, sans les montants ; ne pointe pas.
        Sanctum::actingAs(User::factory()->withRoles(Role::Commercial)->create());
        $this->getJson('/api/workers')->assertOk()->assertJsonMissingPath('data.0.balance');
        $this->postJson("/api/worksites/{$this->worksite->id}/attendances", ['worked_on' => '2026-10-12', 'entries' => [['worker_id' => $this->mason->id, 'days' => 1]]])->assertForbidden();

        // Comptable : paie, mais ne pointe pas.
        Sanctum::actingAs(User::factory()->withRoles(Role::Comptable)->create());
        $this->postJson("/api/workers/{$this->mason->id}/payments", ['kind' => 'avance', 'amount' => 5_000, 'method' => 'especes'])->assertCreated();
        $this->postJson("/api/worksites/{$this->worksite->id}/attendances", ['worked_on' => '2026-10-12', 'entries' => [['worker_id' => $this->mason->id, 'days' => 1]]])->assertForbidden();
        $this->postJson('/api/workers', ['name' => 'X', 'pay_type' => 'journalier'])->assertForbidden();
    }

    public function test_budget_overrun_beyond_ten_percent_creates_one_alert(): void
    {
        $this->putJson("/api/worksites/{$this->worksite->id}", ['budget_materials' => 50_000, 'budget_labor' => 50_000])->assertOk();

        // 110 000 : exactement +10 %, pas encore d'alerte.
        $this->postJson("/api/worksites/{$this->worksite->id}/cash", ['kind' => 'depense', 'category' => 'materiaux', 'amount' => 102_000, 'label' => 'Ciment'])->assertCreated();
        $this->postJson("/api/worksites/{$this->worksite->id}/attendances", ['worked_on' => '2026-10-12', 'entries' => [['worker_id' => $this->mason->id, 'days' => 1]]])->assertCreated();
        $this->assertSame(0, Task::count());

        // 114 000 : alerte au chef de chantier, une seule fois.
        $this->postJson("/api/worksites/{$this->worksite->id}/attendances", ['worked_on' => '2026-10-11', 'entries' => [['worker_id' => $this->mason->id, 'days' => 0.5]]])->assertCreated();
        $this->assertSame(1, Task::count());
        $this->postJson("/api/worksites/{$this->worksite->id}/cash", ['kind' => 'depense', 'category' => 'transport', 'amount' => 5_000, 'label' => 'Camion'])->assertCreated();
        $this->assertSame(1, Task::count());
        $task = Task::first();
        $this->assertSame($this->manager->id, $task->user_id);
        $this->assertStringContainsString('budget dépassé de 14 %', $task->title);

        $this->getJson("/api/worksites/{$this->worksite->id}/budget")
            ->assertOk()
            ->assertJsonPath('data.actual.materials', 102_000)
            ->assertJsonPath('data.actual.labor', 12_000)
            ->assertJsonPath('data.actual.other', 5_000)
            ->assertJsonPath('data.actual.total', 119_000)
            ->assertJsonPath('data.over_budget', true)
            ->assertJsonPath('data.labor_detail.days', 1.5);

        // Budget relevé puis dépassé à nouveau : nouvelle alerte.
        $this->putJson("/api/worksites/{$this->worksite->id}", ['budget_other' => 20_000])->assertOk();
        $this->assertSame(1, Task::count());
        $this->postJson("/api/worksites/{$this->worksite->id}/cash", ['kind' => 'depense', 'category' => 'divers', 'amount' => 20_000, 'label' => 'Gardiennage'])->assertCreated();
        $this->assertSame(2, Task::count());
    }

    public function test_budget_requires_the_costs_permission(): void
    {
        Sanctum::actingAs(User::factory()->withRoles(Role::Commercial)->create());
        $this->getJson("/api/worksites/{$this->worksite->id}/budget")->assertForbidden();
    }
}
