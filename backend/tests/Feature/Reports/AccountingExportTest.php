<?php

namespace Tests\Feature\Reports;

use App\Enums\Role;
use App\Models\Article;
use App\Models\Client;
use App\Models\CompanySetting;
use App\Models\Invoice;
use App\Models\User;
use App\Services\Billing;
use App\Services\PurchaseService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;
use OpenSpout\Reader\XLSX\Reader;
use Tests\TestCase;

class AccountingExportTest extends TestCase
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

    private function invoice(string $activity, int $amount, string $issued, int $vat = 18): Invoice
    {
        return Billing::issue(Billing::saveDraft(new Invoice(['client_id' => $this->client->id, 'activity' => $activity, 'issue_date' => $issued, 'due_date' => $issued]), [], [
            ['description' => 'Prestation', 'quantity' => 1, 'unit_price' => $amount, 'vat_rate' => $vat],
        ]), $this->accountant);
    }

    /**
     * Relit le classeur téléchargé : feuille => lignes (en-tête compris).
     *
     * @return array<string, list<list<mixed>>>
     */
    private function read(TestResponse $response): array
    {
        $response->assertOk()->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        $path = $response->baseResponse->getFile()->getPathname();
        $copy = tempnam(sys_get_temp_dir(), 'test-xlsx-');
        copy($path, $copy);
        $reader = new Reader;
        $reader->open($copy);
        $sheets = [];
        foreach ($reader->getSheetIterator() as $sheet) {
            foreach ($sheet->getRowIterator() as $row) {
                $sheets[$sheet->getName()][] = $row->toArray();
            }
        }
        $reader->close();
        unlink($copy);

        return $sheets;
    }

    public function test_the_sales_journal_gives_balanced_entries_with_the_accounts_of_each_activity(): void
    {
        $works = $this->invoice('travaux', 1_000_000, '2026-10-05');
        $this->invoice('location', 300_000, '2026-10-06', 0);
        $credit = Billing::prepareCreditNote($works, $this->accountant);
        Billing::saveDraft($credit, [], [['description' => 'Remise', 'quantity' => 1, 'unit_price' => 100_000, 'vat_rate' => 18]]);
        Billing::issue($credit, $this->accountant);
        $this->invoice('negoce', 50_000, '2026-09-30');

        $sheets = $this->read($this->get('/api/reports/exports/ventes?from=2026-10-01&to=2026-10-31'));
        $entries = array_slice($sheets['Écritures'], 1);

        // Facture travaux : 3 lignes ; location sans TVA : 2 ; avoir : 3.
        $this->assertCount(8, $entries);
        $this->assertSame(['VT', '4111', 'C'.str_pad((string) $this->client->id, 5, '0', STR_PAD_LEFT), 1_180_000], [$entries[0][0], $entries[0][3], $entries[0][4], $entries[0][6]]);
        $this->assertSame(['705', 1_000_000], [$entries[1][3], $entries[1][7]]);
        $this->assertSame(['4431', 180_000], [$entries[2][3], $entries[2][7]]);
        $this->assertSame('7073', $entries[4][3]);
        // Avoir : client au crédit.
        $this->assertSame(118_000, $entries[5][7]);
        // Équilibre pièce par pièce.
        foreach (collect($entries)->groupBy(2) as $piece => $lines) {
            $this->assertSame((int) $lines->sum(fn ($l) => (int) $l[6]), (int) $lines->sum(fn ($l) => (int) $l[7]), "Pièce {$piece} déséquilibrée");
        }
        $this->assertCount(4, $sheets['Factures']);
    }

    public function test_collections_purchases_and_balances(): void
    {
        $rent = $this->invoice('location', 200_000, '2026-09-01', 0);
        Billing::recordPayment($rent, ['method' => 'wave', 'amount' => 150_000, 'reference' => 'W-9', 'paid_on' => '2026-10-03'], $this->accountant);
        $supplier = Client::factory()->create(['name' => 'Sococim']);
        $cement = Article::create(['reference' => 'CIM', 'name' => 'Ciment', 'unit' => 'sac']);
        $purchase = app(PurchaseService::class)->record(['supplier_id' => $supplier->id, 'received_on' => '2026-10-02', 'due_date' => '2026-10-10'], [
            ['article_id' => $cement->id, 'quantity' => 100, 'unit_cost' => 4_000],
        ], $this->accountant);
        app(PurchaseService::class)->pay($purchase, ['amount' => 200_000, 'method' => 'virement', 'reference' => 'VIR-1', 'paid_on' => '2026-10-04'], $this->accountant);

        $cash = $this->read($this->get('/api/reports/exports/encaissements?from=2026-10-01&to=2026-10-31'));
        $this->assertSame(['TR', '5211', 150_000], [$cash['Écritures'][1][0], $cash['Écritures'][1][3], $cash['Écritures'][1][6]]);
        $this->assertSame(['4111', 150_000], [$cash['Écritures'][2][3], $cash['Écritures'][2][7]]);

        $buys = $this->read($this->get('/api/reports/exports/achats?from=2026-10-01&to=2026-10-31'));
        $this->assertSame([['601', 400_000, ''], ['4452', 72_000, ''], ['4011', '', 472_000]], array_map(fn ($l) => [$l[3], $l[6], $l[7]], array_slice($buys['Écritures'], 1, 3)));
        $this->assertSame(['4011', 200_000], [$buys['Écritures'][4][3], $buys['Écritures'][4][6]]);
        $this->assertSame(272_000, $buys['Achats'][1][9]);
        $this->assertCount(2, $buys['Règlements fournisseurs']);

        $clients = $this->read($this->get('/api/reports/exports/balance-clients?to=2026-10-31&from=2026-01-01'));
        $this->assertSame(['Awa Ndiaye', 200_000, 150_000, 50_000, 50_000], [$clients['Balance clients'][1][2], $clients['Balance clients'][1][4], $clients['Balance clients'][1][6], $clients['Balance clients'][1][7], $clients['Balance clients'][1][8]]);
        // À une date antérieure au paiement, tout reste dû.
        $before = $this->read($this->get('/api/reports/exports/balance-clients?from=2026-01-01&to=2026-09-30'));
        $this->assertSame(200_000, $before['Balance clients'][1][7]);

        $suppliers = $this->read($this->get('/api/reports/exports/balance-fournisseurs?from=2026-01-01&to=2026-10-31'));
        $this->assertSame(['Sococim', 472_000, 200_000, 272_000, 272_000], array_values(array_intersect_key($suppliers['Balance fournisseurs'][1], array_flip([2, 4, 5, 6, 7]))));
    }

    public function test_accounts_can_be_changed_and_are_used_by_the_exports(): void
    {
        $this->invoice('travaux', 100_000, '2026-10-05');
        $accounts = $this->getJson('/api/settings/accounting')->assertOk()->json('data.accounts');
        $accounts['sales']['travaux'] = '7051';
        $accounts['client_prefix'] = 'CLI';
        $this->putJson('/api/settings/accounting', $accounts)->assertOk()->assertJsonPath('data.accounts.sales.travaux', '7051');
        $this->assertEquals(['sales' => ['travaux' => '7051'], 'client_prefix' => 'CLI'], CompanySetting::current()->accounting);

        $entries = $this->read($this->get('/api/reports/exports/ventes?from=2026-10-01&to=2026-10-31'))['Écritures'];
        $this->assertSame('7051', $entries[2][3]);
        $this->assertStringStartsWith('CLI', $entries[1][4]);

        $accounts['vat_collected'] = '44-31';
        $this->putJson('/api/settings/accounting', $accounts)->assertJsonValidationErrors('vat_collected');
    }

    public function test_exports_require_the_permission(): void
    {
        Sanctum::actingAs(User::factory()->withRoles(Role::ResponsableTravaux)->create());
        $this->get('/api/reports/exports/ventes')->assertForbidden();
        $this->getJson('/api/settings/accounting')->assertForbidden();
        Sanctum::actingAs($this->accountant);
        $this->get('/api/reports/exports/inconnu')->assertNotFound();
    }
}
