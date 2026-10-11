<?php

namespace Tests\Feature\Reports;

use App\Enums\Role;
use App\Models\Article;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\User;
use App\Services\Billing;
use App\Services\WorksiteService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class GlobalSearchTest extends TestCase
{
    use RefreshDatabase;

    public function test_search_groups_results_by_type_and_finds_phones_and_references(): void
    {
        $director = User::factory()->dirigeant()->create();
        Sanctum::actingAs($director);
        $client = Client::factory()->create(['name' => 'Moussa Diop', 'phone' => '+221771234567']);
        app(WorksiteService::class)->create(['client_id' => $client->id, 'title' => 'Villa de Diop à Ngor'], $director);
        Billing::issue(Billing::saveDraft(new Invoice(['client_id' => $client->id, 'activity' => 'travaux']), [], [['description' => 'X', 'quantity' => 1, 'unit_price' => 10_000]]), $director);
        Article::create(['reference' => 'CIM-425', 'name' => 'Ciment 42,5', 'unit' => 'sac']);

        $this->getJson('/api/search?q=diop')->assertOk()
            ->assertJsonPath('data.clients.0.title', 'Moussa Diop')
            ->assertJsonPath('data.clients.0.url', "/admin/clients/{$client->id}")
            ->assertJsonPath('data.worksites.0.title', 'Villa de Diop à Ngor')
            ->assertJsonPath('data.invoices.0.subtitle', '10 000 FCFA · reste 10 000 FCFA')
            ->assertJsonMissingPath('data.articles');
        $this->getJson('/api/search?q=77 123')->assertJsonPath('data.clients.0.id', $client->id);
        $this->getJson('/api/search?q=cim-4')->assertJsonPath('data.articles.0.title', 'Ciment 42,5');
        $this->getJson('/api/search?q=FAC-')->assertJsonCount(1, 'data.invoices');
        $this->getJson('/api/search?q=d')->assertJsonValidationErrors('q');
    }

    public function test_each_group_requires_its_permission(): void
    {
        $client = Client::factory()->create(['name' => 'Moussa Diop']);
        Article::create(['reference' => 'DIOP-1', 'name' => 'Article Diop', 'unit' => 'u']);

        // Responsable travaux : clients et articles, pas de factures.
        Sanctum::actingAs(User::factory()->withRoles(Role::ResponsableTravaux)->create());
        $data = $this->getJson('/api/search?q=diop')->assertOk()->json('data');
        $this->assertArrayHasKey('clients', $data);
        $this->assertArrayHasKey('articles', $data);
        $this->assertArrayNotHasKey('invoices', $data);
        $this->assertArrayNotHasKey('purchases', $data);

        // Compte qui ne consulte que les tâches : rien.
        Sanctum::actingAs(User::factory()->withPermissions('dashboard.view_all')->create());
        $this->getJson('/api/search?q=diop')->assertOk()->assertExactJson(['data' => []]);
        $this->assertNotNull($client->id);
    }
}
