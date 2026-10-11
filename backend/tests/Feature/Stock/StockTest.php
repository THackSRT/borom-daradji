<?php

namespace Tests\Feature\Stock;

use App\Enums\ClientCategory;
use App\Enums\Role;
use App\Enums\WorksiteStatus;
use App\Models\Article;
use App\Models\Client;
use App\Models\Task;
use App\Models\User;
use App\Models\Worksite;
use App\Services\WorksiteService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StockTest extends TestCase
{
    use RefreshDatabase;

    private User $keeper;

    private Client $supplier;

    private Article $cement;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-10-12 10:00');
        User::factory()->dirigeant()->create();
        $this->keeper = User::factory()->withRoles(Role::ResponsableTravaux)->create(['name' => 'Ibou Faye']);
        Sanctum::actingAs($this->keeper);
        $this->supplier = Client::factory()->create(['name' => 'Sococim Distribution', 'categories' => []]);
        $this->cement = Article::findOrFail($this->postJson('/api/articles', [
            'name' => 'Ciment CEM II 42,5 (sac 50 kg)', 'unit' => 'sac', 'sale_price' => 5_200, 'min_quantity' => 20,
        ])->assertCreated()->assertJsonPath('data.reference', 'ART-0001')->json('data.id'));
    }

    /**
     * @param  list<array{0: Article, 1: float, 2: int}>  $lines
     * @param  array<string, mixed>  $extra
     */
    private function purchase(array $lines, array $extra = []): int
    {
        return $this->postJson('/api/purchases', [
            'supplier_id' => $this->supplier->id,
            'supplier_reference' => 'BL-778',
            'lines' => array_map(fn ($l) => ['article_id' => $l[0]->id, 'quantity' => $l[1], 'unit_cost' => $l[2]], $lines),
            ...$extra,
        ])->assertCreated()->json('data.id');
    }

    private function worksite(): Worksite
    {
        $worksite = app(WorksiteService::class)->create(['client_id' => Client::factory()->create()->id, 'title' => 'Villa Ngor', 'manager_id' => $this->keeper->id], $this->keeper);
        $worksite->forceFill(['status' => WorksiteStatus::EnCours])->save();

        return $worksite;
    }

    public function test_purchases_enter_stock_and_the_weighted_average_cost_is_recomputed(): void
    {
        // 100 sacs à 4 500 puis 50 sacs à 4 800 → CMUP (450 000 + 240 000) / 150 = 4 600.
        $first = $this->purchase([[$this->cement, 100, 4_500]]);
        $this->getJson("/api/purchases/{$first}")
            ->assertJsonPath('data.number', 'ACH-2026-0001')
            ->assertJsonPath('data.subtotal', 450_000)
            ->assertJsonPath('data.vat_total', 81_000)
            ->assertJsonPath('data.total', 531_000)
            ->assertJsonPath('data.due_date', '2026-11-11');
        $this->purchase([[$this->cement, 50, 4_800]]);

        $this->getJson("/api/articles/{$this->cement->id}")
            ->assertJsonPath('data.quantity', 150)
            ->assertJsonPath('data.average_cost', 4600)
            ->assertJsonPath('data.purchase_price', 4_800)
            ->assertJsonPath('data.stock_value', 690_000)
            ->assertJsonPath('data.supplier.id', $this->supplier->id)
            ->assertJsonCount(2, 'data.purchase_prices')
            ->assertJsonCount(2, 'data.movements');
        // Le fournisseur reçoit la catégorie « fournisseur ».
        $this->assertContains(ClientCategory::Fournisseur, $this->supplier->fresh()->categories->all());
    }

    public function test_exits_go_out_at_the_average_cost_and_are_charged_to_the_worksite(): void
    {
        $this->purchase([[$this->cement, 100, 4_500]]);
        $this->purchase([[$this->cement, 50, 4_800]]);
        $worksite = $this->worksite();

        $this->postJson("/api/worksites/{$worksite->id}/stock-exits", ['lines' => [['article_id' => $this->cement->id, 'quantity' => 30]]])
            ->assertCreated()
            ->assertJsonPath('data.0.value', -138_000);
        // Le CMUP ne change pas à la sortie ; un nouvel achat ne modifie pas le coût déjà imputé.
        $this->purchase([[$this->cement, 120, 5_000]]);
        $this->assertEqualsWithDelta((120 * 4600 + 120 * 5000) / 240, $this->cement->fresh()->average_cost, 0.01);

        // Retour de 10 sacs au coût de sortie (4 600), pas au CMUP du jour.
        $this->postJson("/api/worksites/{$worksite->id}/stock-returns", ['article_id' => $this->cement->id, 'quantity' => 10])->assertCreated();
        $this->postJson("/api/worksites/{$worksite->id}/stock-returns", ['article_id' => $this->cement->id, 'quantity' => 25])->assertJsonValidationErrors('quantity');

        $this->getJson("/api/worksites/{$worksite->id}/stock")
            ->assertOk()
            ->assertJsonPath('data.articles.0.quantity', 20)
            ->assertJsonPath('data.total', 92_000);
        $this->getJson("/api/worksites/{$worksite->id}/budget")
            ->assertJsonPath('data.actual.materials', 92_000)
            ->assertJsonPath('data.materials_detail.stock', 92_000);
    }

    public function test_no_exit_beyond_the_stock_and_losses_need_a_reason(): void
    {
        $this->purchase([[$this->cement, 10, 4_500]]);
        $worksite = $this->worksite();

        $this->postJson("/api/worksites/{$worksite->id}/stock-exits", ['lines' => [['article_id' => $this->cement->id, 'quantity' => 12]]])
            ->assertJsonValidationErrors('quantity');
        $this->postJson("/api/articles/{$this->cement->id}/loss", ['quantity' => 2])->assertJsonValidationErrors('reason');
        $this->postJson("/api/articles/{$this->cement->id}/loss", ['quantity' => 2, 'reason' => 'Sacs mouillés par la pluie'])
            ->assertCreated()
            ->assertJsonPath('data.type.value', 'perte')
            ->assertJsonPath('data.value', -9_000);
        $this->assertEquals(8, $this->cement->fresh()->quantity);

        // Correction à la quantité constatée.
        $this->postJson("/api/articles/{$this->cement->id}/correction", ['counted_quantity' => 7, 'reason' => 'Recomptage'])->assertCreated();
        $this->postJson("/api/articles/{$this->cement->id}/correction", ['counted_quantity' => 7, 'reason' => 'Recomptage'])->assertJsonValidationErrors('counted_quantity');
        $this->assertEquals(7, $this->cement->fresh()->quantity);

        // Chantier fermé : plus de sortie.
        $worksite->forceFill(['status' => WorksiteStatus::Termine])->save();
        $this->postJson("/api/worksites/{$worksite->id}/stock-exits", ['lines' => [['article_id' => $this->cement->id, 'quantity' => 1]]])
            ->assertJsonValidationErrors('worksite');
    }

    public function test_reaching_the_alert_threshold_creates_one_restocking_task(): void
    {
        $this->purchase([[$this->cement, 30, 4_500]]);
        $worksite = $this->worksite();

        $this->postJson("/api/worksites/{$worksite->id}/stock-exits", ['lines' => [['article_id' => $this->cement->id, 'quantity' => 5]]])->assertCreated();
        $this->assertSame(0, Task::count());
        $this->postJson("/api/worksites/{$worksite->id}/stock-exits", ['lines' => [['article_id' => $this->cement->id, 'quantity' => 6]]])->assertCreated();
        $this->postJson("/api/articles/{$this->cement->id}/loss", ['quantity' => 1, 'reason' => 'Sac percé'])->assertCreated();
        $this->assertSame(1, Task::count());
        $this->assertStringContainsString('Réapprovisionner Ciment', Task::first()->title);
        $this->assertStringContainsString('Sococim Distribution', Task::first()->details);
        $this->getJson('/api/articles?low=1')->assertJsonCount(1, 'data')->assertJsonPath('summary.low', 1);

        // Réapprovisionné au-dessus du seuil, puis de nouveau en dessous : nouvelle alerte.
        $this->purchase([[$this->cement, 40, 4_500]]);
        $this->postJson("/api/worksites/{$worksite->id}/stock-exits", ['lines' => [['article_id' => $this->cement->id, 'quantity' => 40]]])->assertCreated();
        $this->assertSame(2, Task::count());
    }

    public function test_supplier_payments_in_cash_leave_the_till_and_can_be_cancelled(): void
    {
        // Sans caisse (responsable travaux), pas de paiement en espèces.
        $other = $this->purchase([[$this->cement, 1, 4_500]]);
        $this->postJson("/api/purchases/{$other}/payments", ['amount' => 1_000, 'method' => 'especes'])->assertJsonValidationErrors('method');

        Sanctum::actingAs(User::factory()->withRoles(Role::Comptable)->create());
        $this->putJson('/api/cash-sessions/current', ['opening_amount' => 300_000])->assertOk();
        $id = $this->purchase([[$this->cement, 40, 4_500]], ['payment' => ['amount' => 100_000, 'method' => 'especes']]);

        $this->getJson("/api/purchases/{$id}")->assertJsonPath('data.paid_total', 100_000)->assertJsonPath('data.balance', 112_400);
        $this->getJson('/api/cash-sessions/current')->assertJsonPath('data.expected_amount', 200_000);

        $this->postJson("/api/purchases/{$id}/payments", ['amount' => 200_000, 'method' => 'wave', 'reference' => 'W-1'])->assertJsonValidationErrors('amount');
        $this->postJson("/api/purchases/{$id}/payments", ['amount' => 112_400, 'method' => 'wave'])->assertJsonValidationErrors('reference');
        $this->postJson("/api/purchases/{$id}/payments", ['amount' => 112_400, 'method' => 'wave', 'reference' => 'W-1'])->assertCreated()->assertJsonPath('data.balance', 0);
        $this->getJson('/api/purchases?state=a_payer')->assertJsonCount(1, 'data');

        $cash = $this->getJson("/api/purchases/{$id}")->json('data.payments.0.id');
        $this->postJson("/api/purchases/{$id}/payments/{$cash}/cancel", ['reason' => 'Erreur de montant'])->assertOk()->assertJsonPath('data.balance', 100_000);
        $this->getJson('/api/cash-sessions/current')->assertJsonPath('data.expected_amount', 300_000);
        $this->getJson('/api/purchases?state=a_payer')->assertJsonPath('summary.unpaid_total', 100_000 + 5_310);
    }

    public function test_cancelling_a_purchase_takes_the_goods_back_out_at_their_cost(): void
    {
        $this->purchase([[$this->cement, 100, 4_500]]);
        $wrong = $this->purchase([[$this->cement, 50, 4_800]], ['payment' => ['amount' => 10_000, 'method' => 'wave', 'reference' => 'W-2']]);

        $this->postJson("/api/purchases/{$wrong}/cancel", ['reason' => 'Doublon'])->assertJsonValidationErrors('purchase');
        $payment = $this->getJson("/api/purchases/{$wrong}")->json('data.payments.0.id');
        $this->postJson("/api/purchases/{$wrong}/payments/{$payment}/cancel", ['reason' => 'Doublon'])->assertOk();
        $this->postJson("/api/purchases/{$wrong}/cancel", ['reason' => 'Doublon'])->assertOk()->assertJsonPath('data.balance', 0);

        $cement = $this->cement->fresh();
        $this->assertEquals(100, $cement->quantity);
        $this->assertEqualsWithDelta(4500, $cement->average_cost, 0.001);

        // Marchandise déjà sortie : annulation refusée.
        $sold = $this->purchase([[$this->cement, 10, 5_000]]);
        $this->postJson("/api/worksites/{$this->worksite()->id}/stock-exits", ['lines' => [['article_id' => $this->cement->id, 'quantity' => 105]]])->assertCreated();
        $this->postJson("/api/purchases/{$sold}/cancel", ['reason' => 'Erreur'])->assertJsonValidationErrors('purchase');
    }

    public function test_permissions_and_cost_visibility(): void
    {
        $this->purchase([[$this->cement, 10, 4_500]]);

        // Commercial : voit le stock et les prix de vente, pas les coûts ; n'achète pas, ne sort pas.
        Sanctum::actingAs(User::factory()->withRoles(Role::Commercial)->create());
        $this->getJson('/api/articles')->assertOk()->assertJsonMissingPath('data.0.average_cost')->assertJsonMissingPath('summary.stock_value');
        $this->postJson('/api/purchases', ['supplier_id' => $this->supplier->id, 'lines' => [['article_id' => $this->cement->id, 'quantity' => 1, 'unit_cost' => 1]]])->assertForbidden();
        $this->postJson("/api/articles/{$this->cement->id}/loss", ['quantity' => 1, 'reason' => 'X'])->assertForbidden();
        $this->postJson('/api/articles', ['name' => 'X', 'unit' => 'u'])->assertForbidden();

        // Comptable : achats et coûts, pas de fiches articles ni de sorties.
        Sanctum::actingAs(User::factory()->withRoles(Role::Comptable)->create());
        $this->getJson('/api/articles')->assertJsonPath('summary.stock_value', 45_000);
        $this->getJson('/api/purchases')->assertOk();
        $this->putJson("/api/articles/{$this->cement->id}", ['sale_price' => 1])->assertForbidden();

        // Agent immobilier : rien.
        Sanctum::actingAs(User::factory()->withRoles(Role::Agent)->create());
        $this->getJson('/api/articles')->assertForbidden();
    }
}
