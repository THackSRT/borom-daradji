<?php

namespace Tests\Feature\Works;

use App\Enums\Role;
use App\Enums\WorksiteStatus;
use App\Models\Client;
use App\Models\User;
use App\Models\Worksite;
use App\Services\WorksiteService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SiteCashTest extends TestCase
{
    use RefreshDatabase;

    private User $manager;

    private User $accountant;

    private Worksite $worksite;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-10-12 10:00');
        Storage::fake('local');
        User::factory()->dirigeant()->create();
        // Chef de chantier : consulte les chantiers et tient la caisse, sans plus.
        $this->manager = User::factory()->withPermissions('works.view', 'works.cash')->create(['name' => 'Ibou Faye']);
        $this->accountant = User::factory()->withRoles(Role::Comptable)->create();
        $this->worksite = app(WorksiteService::class)->create(['client_id' => Client::factory()->create()->id, 'title' => 'Villa Ngor', 'manager_id' => $this->manager->id], $this->accountant);
        $this->worksite->forceFill(['status' => WorksiteStatus::EnCours])->save();
    }

    private function url(string $suffix = ''): string
    {
        return "/api/worksites/{$this->worksite->id}/cash{$suffix}";
    }

    public function test_supply_from_the_till_goes_out_of_the_cash_of_the_day_and_back_when_cancelled(): void
    {
        Sanctum::actingAs($this->accountant);
        $this->putJson('/api/cash-sessions/current', ['opening_amount' => 200_000])->assertOk();

        // Pas plus que ce qu'il y a dans la caisse du jour.
        $this->postJson($this->url(), ['kind' => 'approvisionnement', 'amount' => 300_000, 'from_cash_register' => true])->assertJsonValidationErrors('from_cash_register');

        $entry = $this->postJson($this->url(), ['kind' => 'approvisionnement', 'amount' => 150_000, 'from_cash_register' => true])
            ->assertCreated()
            ->assertJsonPath('data.from_cash_register', true)
            ->json('data.id');
        $this->getJson('/api/cash-sessions/current')->assertJsonPath('data.expected_amount', 50_000);
        $this->getJson($this->url())->assertJsonPath('data.totals.balance', 150_000);

        $this->postJson($this->url("/{$entry}/cancel"), ['reason' => 'Mauvais chantier'])->assertOk();
        $this->getJson('/api/cash-sessions/current')->assertJsonPath('data.expected_amount', 200_000);
        $this->getJson($this->url())->assertJsonPath('data.totals.balance', 0);
        $this->postJson($this->url("/{$entry}/cancel"), ['reason' => 'Encore'])->assertJsonValidationErrors('entry');
    }

    public function test_expenses_with_receipts_and_the_leftover_returned(): void
    {
        Sanctum::actingAs($this->accountant);
        $this->postJson($this->url(), ['kind' => 'approvisionnement', 'amount' => 100_000])->assertCreated();

        Sanctum::actingAs($this->manager);
        $this->postJson($this->url(), [
            'kind' => 'depense', 'category' => 'materiaux', 'amount' => 45_000, 'label' => '10 sacs de ciment',
            'receipt' => UploadedFile::fake()->image('recu.jpg', 800, 1200),
        ])->assertCreated()->assertJsonPath('data.category.value', 'materiaux');
        $without = $this->postJson($this->url(), ['kind' => 'depense', 'category' => 'transport', 'amount' => 15_000, 'label' => 'Charrette'])
            ->assertCreated()->assertJsonPath('data.receipt_url', null)->json('data.id');

        $this->getJson($this->url())
            ->assertJsonPath('data.totals.depense', 60_000)
            ->assertJsonPath('data.totals.balance', 40_000)
            ->assertJsonPath('data.totals.missing_receipts', 1);

        // Reçu ajouté après coup.
        $receipt = $this->postJson($this->url("/{$without}/receipt"), ['receipt' => UploadedFile::fake()->image('r.png')])
            ->assertOk()->json('data.receipt_url');
        $this->get('/api'.$receipt)->assertOk();
        $this->getJson($this->url())->assertJsonPath('data.totals.missing_receipts', 0);

        // Le chef ne rend pas lui-même le reliquat à l'agence (droit « works.payments »).
        $this->postJson($this->url(), ['kind' => 'retour', 'amount' => 40_000])->assertForbidden();
        Sanctum::actingAs($this->accountant);
        $this->postJson($this->url(), ['kind' => 'retour', 'amount' => 50_000])->assertJsonValidationErrors('amount');
        $this->postJson($this->url(), ['kind' => 'retour', 'amount' => 40_000, 'to_cash_register' => true])->assertCreated();
        $this->getJson('/api/cash-sessions/current')->assertJsonPath('data.expected_amount', 40_000);
        $this->getJson($this->url())->assertJsonPath('data.totals.balance', 0);
    }

    public function test_an_expense_beyond_the_balance_is_accepted_and_offline_retries_are_ignored(): void
    {
        Sanctum::actingAs($this->manager);
        $uuid = (string) Str::uuid();
        $payload = ['kind' => 'depense', 'category' => 'divers', 'amount' => 5_000, 'label' => 'Eau', 'client_uuid' => $uuid];

        $this->postJson($this->url(), $payload)->assertCreated();
        $this->postJson($this->url(), $payload)->assertOk();
        // Le chef a avancé de sa poche : solde négatif.
        $this->getJson($this->url())->assertJsonPath('data.totals.balance', -5_000)->assertJsonCount(1, 'data.entries');
    }

    public function test_a_closed_till_freezes_the_supplies_it_paid(): void
    {
        Sanctum::actingAs($this->accountant);
        $this->putJson('/api/cash-sessions/current', ['opening_amount' => 100_000])->assertOk();
        $entry = $this->postJson($this->url(), ['kind' => 'approvisionnement', 'amount' => 30_000, 'from_cash_register' => true])->json('data.id');
        $session = $this->getJson('/api/cash-sessions/current')->json('data.id');
        $this->postJson("/api/cash-sessions/{$session}/close", ['counted_amount' => 70_000])->assertOk();

        $this->postJson($this->url("/{$entry}/cancel"), ['reason' => 'Erreur'])->assertJsonValidationErrors('entry');
    }

    public function test_cash_permissions(): void
    {
        // Commercial : rien sur la caisse du chantier.
        Sanctum::actingAs(User::factory()->withRoles(Role::Commercial)->create());
        $this->getJson($this->url())->assertForbidden();

        // Chef de chantier : dépense, mais n'approvisionne pas.
        Sanctum::actingAs($this->manager);
        $this->postJson($this->url(), ['kind' => 'approvisionnement', 'amount' => 10_000])->assertForbidden();

        // Comptable : approvisionne, ne saisit pas de dépense.
        Sanctum::actingAs($this->accountant);
        $this->postJson($this->url(), ['kind' => 'depense', 'category' => 'divers', 'amount' => 1_000, 'label' => 'X'])->assertForbidden();
        $this->getJson($this->url())->assertOk()->assertJsonPath('data.can.supply', true)->assertJsonPath('data.can.spend', false);
    }
}
