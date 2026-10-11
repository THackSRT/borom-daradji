<?php

namespace Tests\Feature\Reports;

use App\Enums\Role;
use App\Enums\WorksiteStatus;
use App\Models\Article;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\User;
use App\Services\Billing;
use App\Services\PurchaseService;
use App\Services\WorksiteService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OverviewTest extends TestCase
{
    use RefreshDatabase;

    private User $accountant;

    private Client $client;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-10-20 10:00');
        $this->accountant = User::factory()->withRoles(Role::Comptable)->create();
        $this->client = Client::factory()->create(['name' => 'Awa Ndiaye']);
        Sanctum::actingAs($this->accountant);
    }

    private function invoice(string $activity, int $amount, string $issued, ?string $due = null): Invoice
    {
        return Billing::issue(Billing::saveDraft(new Invoice([
            'client_id' => $this->client->id, 'activity' => $activity, 'issue_date' => $issued, 'due_date' => $due,
        ]), [], [['description' => 'Prestation', 'quantity' => 1, 'unit_price' => $amount, 'vat_rate' => 18]]), $this->accountant);
    }

    public function test_revenue_by_activity_nets_credit_notes_and_compares_with_the_previous_period(): void
    {
        $this->invoice('travaux', 1_000_000, '2026-10-05');
        $this->invoice('negoce', 200_000, '2026-10-12');
        $commission = $this->invoice('immobilier', 500_000, '2026-10-15');
        $this->invoice('travaux', 300_000, '2026-09-10');
        // Avoir de 100 000 HT sur la commission.
        $credit = Billing::prepareCreditNote($commission, $this->accountant);
        Billing::saveDraft($credit, [], [['description' => 'Remise', 'quantity' => 1, 'unit_price' => 100_000, 'vat_rate' => 18]]);
        Billing::issue($credit, $this->accountant);
        // Brouillon : ne compte pas.
        Billing::saveDraft(new Invoice(['client_id' => $this->client->id, 'activity' => 'travaux']), [], [['description' => 'X', 'quantity' => 1, 'unit_price' => 999_000]]);

        $response = $this->getJson('/api/reports/overview')->assertOk()
            ->assertJsonPath('data.period.from', '2026-10-01')
            ->assertJsonPath('data.revenue.total', 1_600_000)
            ->assertJsonPath('data.revenue.previous_total', 300_000)
            ->assertJsonCount(12, 'data.revenue.monthly');

        $byActivity = collect($response->json('data.revenue.by_activity'))->mapWithKeys(fn ($r) => [$r['activity']['value'] => $r['amount']]);
        $this->assertSame(1_000_000, $byActivity['travaux']);
        $this->assertSame(400_000, $byActivity['immobilier']);
        $this->assertSame(200_000, $byActivity['negoce']);
        $october = collect($response->json('data.revenue.monthly'))->firstWhere('month', '2026-10');
        $this->assertSame(1_000_000, $october['travaux']);

        $this->getJson('/api/reports/overview?period=mois_precedent')->assertJsonPath('data.revenue.total', 300_000);
        $this->getJson('/api/reports/overview?from=2026-09-01&to=2026-10-31')->assertJsonPath('data.revenue.total', 1_900_000);
    }

    public function test_collections_exclude_deposit_retentions_and_receivables_are_aged(): void
    {
        $old = $this->invoice('location', 100_000, '2026-07-01', '2026-07-10');
        $recent = $this->invoice('location', 200_000, '2026-10-01', '2026-10-15');
        $future = $this->invoice('travaux', 50_000, '2026-10-18', '2026-11-02');
        Billing::recordPayment($recent, ['method' => 'wave', 'amount' => 36_000, 'reference' => 'W-1', 'paid_on' => '2026-10-16'], $this->accountant);
        Billing::recordPayment($old, ['method' => 'caution', 'amount' => 18_000, 'paid_on' => '2026-10-16'], $this->accountant);

        $this->getJson('/api/reports/overview')
            ->assertJsonPath('data.collections.total', 36_000)
            ->assertJsonPath('data.collections.by_method.0.method.value', 'wave')
            // 118 000 − 18 000 = 100 000 à plus de 90 jours ; 236 000 − 36 000 à 5 jours ; 59 000 pas échu.
            ->assertJsonPath('data.receivables.buckets.over_90', 100_000)
            ->assertJsonPath('data.receivables.buckets.d0_30', 200_000)
            ->assertJsonPath('data.receivables.buckets.not_due', 59_000)
            ->assertJsonPath('data.receivables.overdue', 300_000)
            ->assertJsonPath('data.receivables.top_debtors.0.client.name', 'Awa Ndiaye')
            ->assertJsonPath('data.receivables.top_debtors.0.amount', 359_000);
        $this->assertNotNull($future->number);
    }

    public function test_late_worksites_low_stock_and_supplier_debts_are_listed(): void
    {
        $site = app(WorksiteService::class)->create(['client_id' => $this->client->id, 'title' => 'Villa Ngor', 'planned_end_date' => '2026-10-01'], $this->accountant);
        $site->forceFill(['status' => WorksiteStatus::EnCours])->save();
        $cement = Article::create(['reference' => 'CIM', 'name' => 'Ciment', 'unit' => 'sac', 'min_quantity' => 50]);
        app(PurchaseService::class)->record(['supplier_id' => Client::factory()->create()->id, 'received_on' => '2026-09-01', 'due_date' => '2026-10-01'], [
            ['article_id' => $cement->id, 'quantity' => 10, 'unit_cost' => 4_000],
        ], $this->accountant);

        $this->getJson('/api/reports/overview')
            ->assertJsonPath('data.worksites.open', 1)
            ->assertJsonPath('data.worksites.late', 1)
            ->assertJsonPath('data.worksites.attention.0.reference', $site->reference)
            ->assertJsonPath('data.stock.low_count', 1)
            ->assertJsonPath('data.stock.value', 40_000)
            ->assertJsonPath('data.payables.total', 47_200)
            ->assertJsonPath('data.payables.overdue', 47_200);
    }

    public function test_the_overview_requires_the_reports_permission(): void
    {
        Sanctum::actingAs(User::factory()->withRoles(Role::Agent)->create());
        $this->getJson('/api/reports/overview')->assertForbidden();

        Sanctum::actingAs(User::factory()->dirigeant()->create());
        $this->getJson('/api/reports/overview?period=annee')->assertOk()->assertJsonPath('data.period.from', '2026-01-01')
            ->assertJsonPath('data.previous_period.from', '2025-01-01')->assertJsonPath('data.previous_period.to', '2025-10-20');
        $this->getJson('/api/reports/overview?period=trimestre')->assertJsonPath('data.previous_period.from', '2026-07-01')->assertJsonPath('data.previous_period.to', '2026-07-20');
        $this->getJson('/api/reports/overview?period=mois_precedent')->assertJsonPath('data.previous_period.from', '2026-08-01')->assertJsonPath('data.previous_period.to', '2026-08-31');
        $this->getJson('/api/reports/overview?from=2026-10-11&to=2026-10-20')->assertJsonPath('data.previous_period.from', '2026-10-01')->assertJsonPath('data.previous_period.to', '2026-10-10');
        $this->getJson('/api/reports/overview?from=2026-10-10&to=2026-10-01')->assertJsonValidationErrors('to');
    }
}
