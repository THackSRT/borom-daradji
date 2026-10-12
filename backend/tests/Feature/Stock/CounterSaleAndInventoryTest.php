<?php

namespace Tests\Feature\Stock;

use App\Enums\Role;
use App\Models\Article;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\User;
use App\Services\PurchaseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CounterSaleAndInventoryTest extends TestCase
{
    use RefreshDatabase;

    private User $accountant;

    private Article $cement;

    private Article $iron;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-10-12 10:00');
        $director = User::factory()->dirigeant()->create();
        $this->accountant = User::factory()->withRoles(Role::Comptable)->create();
        $this->cement = Article::create(['reference' => 'CIM-50', 'name' => 'Ciment 42,5 (sac 50 kg)', 'unit' => 'sac', 'sale_price' => 5_200, 'vat_rate' => 18]);
        $this->iron = Article::create(['reference' => 'FER-10', 'name' => 'Fer à béton HA 10', 'unit' => 'barre', 'sale_price' => 4_000, 'vat_rate' => 18]);
        app(PurchaseService::class)->record(['supplier_id' => Client::factory()->create()->id], [
            ['article_id' => $this->cement->id, 'quantity' => 100, 'unit_cost' => 4_500],
            ['article_id' => $this->iron->id, 'quantity' => 50, 'unit_cost' => 3_200],
        ], $director);
        Sanctum::actingAs($this->accountant);
    }

    public function test_a_counter_sale_issues_the_invoice_takes_stock_out_and_collects_cash(): void
    {
        $this->putJson('/api/cash-sessions/current', ['opening_amount' => 0])->assertOk();

        $sale = $this->postJson('/api/counter-sales', [
            'new_client' => ['name' => 'Entreprise Diallo BTP', 'phone' => '77 555 44 33'],
            'lines' => [
                ['article_id' => $this->cement->id, 'quantity' => 10],
                ['article_id' => $this->iron->id, 'quantity' => 5, 'unit_price' => 3_800],
            ],
            'payment' => ['amount' => 50_000, 'method' => 'especes'],
        ])->assertCreated()
            ->assertJsonPath('data.number', 'FAC-2026-00001')
            ->assertJsonPath('data.total', (52_000 + 19_000) * 118 / 100)
            ->assertJsonPath('data.paid_total', 50_000)
            ->json('data');

        $invoice = Invoice::findOrFail($sale['id']);
        $this->assertSame('negoce', $invoice->activity->value);
        $this->assertSame('emise', $invoice->status->value);
        $this->assertSame($this->cement->id, $invoice->lines[0]->article_id);
        $this->assertEquals(90, $this->cement->fresh()->quantity);
        $this->assertEquals(45, $this->iron->fresh()->quantity);
        $this->getJson('/api/cash-sessions/current')->assertJsonPath('data.expected_amount', 50_000);
        $this->assertSame('+221775554433', Client::find($sale['client']['id'])->phone);

        // Même téléphone : client retrouvé, pas de doublon.
        $again = $this->postJson('/api/counter-sales', [
            'new_client' => ['name' => 'Diallo', 'phone' => '+221775554433'],
            'lines' => [['article_id' => $this->cement->id, 'quantity' => 1]],
        ])->assertCreated()->json('data');
        $this->assertSame($sale['client']['id'], $again['client']['id']);
    }

    public function test_no_sale_beyond_the_stock_and_nothing_is_kept_when_refused(): void
    {
        $this->postJson('/api/counter-sales', [
            'client_id' => Client::factory()->create()->id,
            'lines' => [['article_id' => $this->cement->id, 'quantity' => 10], ['article_id' => $this->iron->id, 'quantity' => 60]],
        ])->assertJsonValidationErrors('quantity');

        $this->assertSame(0, Invoice::count());
        $this->assertEquals(100, $this->cement->fresh()->quantity);
    }

    public function test_returned_goods_come_back_at_their_exit_cost_within_what_was_sold(): void
    {
        $id = $this->postJson('/api/counter-sales', [
            'client_id' => Client::factory()->create()->id,
            'lines' => [['article_id' => $this->cement->id, 'quantity' => 10]],
        ])->json('data.id');

        $this->postJson("/api/invoices/{$id}/stock-returns", ['article_id' => $this->cement->id, 'quantity' => 4])
            ->assertCreated()
            ->assertJsonPath('data.value', 18_000);
        $this->postJson("/api/invoices/{$id}/stock-returns", ['article_id' => $this->cement->id, 'quantity' => 7])->assertJsonValidationErrors('quantity');
        $this->postJson("/api/invoices/{$id}/stock-returns", ['article_id' => $this->iron->id, 'quantity' => 1])->assertJsonValidationErrors('article_id');
        $this->assertEquals(94, $this->cement->fresh()->quantity);
    }

    public function test_selling_and_collecting_require_their_permissions(): void
    {
        Sanctum::actingAs(User::factory()->withRoles(Role::ResponsableTravaux)->create());
        $this->postJson('/api/counter-sales', ['client_id' => Client::factory()->create()->id, 'lines' => [['article_id' => $this->cement->id, 'quantity' => 1]]])
            ->assertForbidden();

        // Vendeur sans droit d'encaisser : vend, mais n'encaisse pas.
        Sanctum::actingAs(User::factory()->withPermissions('stock.view', 'stock.sell')->create());
        $payload = ['client_id' => Client::factory()->create()->id, 'lines' => [['article_id' => $this->cement->id, 'quantity' => 1]]];
        $this->postJson('/api/counter-sales', [...$payload, 'payment' => ['amount' => 1_000, 'method' => 'especes']])->assertForbidden();
        $this->postJson('/api/counter-sales', $payload)->assertCreated();
    }

    public function test_an_inventory_adjusts_counted_articles_and_values_the_differences(): void
    {
        $id = $this->postJson('/api/inventories', [])->assertCreated()
            ->assertJsonPath('data.number', 'INV-2026-001')
            ->assertJsonCount(2, 'data.lines')
            // Comptage à l'aveugle : le stock théorique n'est pas montré.
            ->assertJsonPath('data.lines.0.article.quantity', null)
            ->json('data.id');
        $this->postJson('/api/inventories', [])->assertJsonValidationErrors('inventory');

        $this->putJson("/api/inventories/{$id}", ['counts' => [['article_id' => $this->cement->id, 'counted_quantity' => 97, 'note' => '3 sacs éventrés']]])->assertOk();
        // Une vente pendant le comptage : le théorique est relevé à la validation.
        $this->postJson('/api/counter-sales', ['client_id' => Client::factory()->create()->id, 'lines' => [['article_id' => $this->cement->id, 'quantity' => 2]]])->assertCreated();

        $this->postJson("/api/inventories/{$id}/validate")
            ->assertOk()
            ->assertJsonPath('data.status.value', 'valide')
            ->assertJsonPath('data.value_difference', -4_500);
        $this->assertEquals(97, $this->cement->fresh()->quantity);
        // Le fer, non compté, n'est pas touché.
        $this->assertEquals(50, $this->iron->fresh()->quantity);
        $this->putJson("/api/inventories/{$id}", ['counts' => [['article_id' => $this->iron->id, 'counted_quantity' => 1]]])->assertJsonValidationErrors('inventory');
        $this->getJson("/api/articles/{$this->cement->id}")->assertJsonPath('data.movements.0.type.value', 'inventaire');
    }

    public function test_an_inventory_in_progress_can_be_discarded_and_requires_the_permission(): void
    {
        $id = $this->postJson('/api/inventories', [])->json('data.id');
        $this->deleteJson("/api/inventories/{$id}")->assertNoContent();
        $this->postJson('/api/inventories', [])->assertCreated();

        Sanctum::actingAs(User::factory()->withRoles(Role::Commercial)->create());
        $this->getJson('/api/inventories')->assertForbidden();
    }
}
