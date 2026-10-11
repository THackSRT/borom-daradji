<?php

namespace Tests\Feature\Works;

use App\Enums\Role;
use App\Models\Client;
use App\Models\User;
use App\Models\Worksite;
use App\Models\WorksitePhoto;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WorksiteTest extends TestCase
{
    use RefreshDatabase;

    private User $manager;

    private Client $client;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-10-12');
        Storage::fake('local');
        User::factory()->dirigeant()->create();
        $this->manager = User::factory()->withRoles(Role::ResponsableTravaux)->create(['name' => 'Ibou Faye']);
        $this->client = Client::factory()->create(['name' => 'Moussa Diop']);
        Sanctum::actingAs($this->manager);
    }

    /**
     * Devis envoyé de deux lots (carrelage 300 000 HT, plomberie 100 000 HT, TVA 18 %).
     */
    private function sentQuote(?int $clientId = null): int
    {
        $id = $this->postJson('/api/quotes', [
            'client_id' => $clientId ?? $this->client->id,
            'title' => 'Rénovation de la salle de bain',
            'site_address' => 'Sacré-Cœur 3',
            'lots' => [
                ['title' => 'Carrelage', 'lines' => [['designation' => 'Pose', 'unit' => 'm²', 'quantity' => 30, 'unit_price' => 10_000, 'vat_rate' => 18]]],
                ['title' => 'Plomberie', 'lines' => [['designation' => 'Sanitaires', 'unit' => 'forfait', 'quantity' => 1, 'unit_price' => 100_000, 'vat_rate' => 18]]],
            ],
        ])->assertCreated()->json('data.id');
        $this->postJson("/api/quotes/{$id}/send")->assertOk();

        return $id;
    }

    private function acceptedWorksite(): int
    {
        $quote = $this->sentQuote();

        return $this->postJson("/api/quotes/{$quote}/accept")->assertOk()->json('data.worksite.id');
    }

    public function test_accepting_a_quote_creates_the_worksite_with_its_lots_and_amount(): void
    {
        $quote = $this->sentQuote();

        $worksiteId = $this->postJson("/api/quotes/{$quote}/accept")
            ->assertOk()
            ->assertJsonPath('data.status.value', 'accepte')
            ->assertJsonPath('data.worksite.reference', 'CH-2026-0001')
            ->json('data.worksite.id');

        $this->getJson("/api/worksites/{$worksiteId}")
            ->assertOk()
            ->assertJsonPath('data.status.value', 'planifie')
            ->assertJsonPath('data.title', 'Rénovation de la salle de bain')
            ->assertJsonPath('data.address', 'Sacré-Cœur 3')
            ->assertJsonPath('data.contract_ht', 400_000)
            ->assertJsonPath('data.contract_total', 472_000)
            ->assertJsonCount(2, 'data.lots')
            ->assertJsonPath('data.lots.0.amount_ht', 300_000)
            ->assertJsonPath('data.quote.id', $quote);
    }

    public function test_a_quote_can_complete_a_worksite_opened_at_the_quote_stage(): void
    {
        $worksite = $this->postJson('/api/worksites', ['client_id' => $this->client->id, 'title' => 'Villa Ngor'])
            ->assertCreated()
            ->assertJsonPath('data.status.value', 'devis')
            ->json('data.id');
        $quote = $this->sentQuote();

        $this->postJson("/api/quotes/{$quote}/accept", ['worksite_id' => $worksite])->assertOk()->assertJsonPath('data.worksite.id', $worksite);
        $this->getJson("/api/worksites/{$worksite}")->assertJsonPath('data.status.value', 'planifie')->assertJsonPath('data.contract_ht', 400_000);

        // Pas de rattachement au chantier d'un autre client.
        $other = $this->sentQuote(Client::factory()->create()->id);
        $this->postJson("/api/quotes/{$other}/accept", ['worksite_id' => $worksite])->assertJsonValidationErrors('worksite_id');
    }

    public function test_statuses_follow_the_workflow_and_are_written_in_the_log(): void
    {
        $id = $this->acceptedWorksite();

        $this->postJson("/api/worksites/{$id}/status", ['status' => 'termine'])->assertJsonValidationErrors('status');
        $this->postJson("/api/worksites/{$id}/status", ['status' => 'en_cours'])
            ->assertOk()
            ->assertJsonPath('data.status.value', 'en_cours')
            ->assertJsonPath('data.start_date', '2026-10-12');
        $this->postJson("/api/worksites/{$id}/status", ['status' => 'suspendu', 'note' => 'Attente du carrelage.'])->assertOk();
        $this->postJson("/api/worksites/{$id}/status", ['status' => 'en_cours'])->assertOk();
        $this->postJson("/api/worksites/{$id}/status", ['status' => 'termine'])->assertOk()->assertJsonPath('data.actual_end_date', '2026-10-12');

        $logs = collect($this->getJson("/api/worksites/{$id}")->json('data.logs'))->pluck('body');
        $this->assertContains('Démarrage du chantier.', $logs);
        $this->assertContains('Chantier suspendu. Attente du carrelage.', $logs);
        $this->assertContains('Fin des travaux.', $logs);
    }

    public function test_progress_is_weighted_by_the_amount_of_each_lot(): void
    {
        $id = $this->acceptedWorksite();
        $lots = $this->getJson("/api/worksites/{$id}")->json('data.lots');

        $this->putJson("/api/worksites/{$id}/lots/{$lots[0]['id']}/progress", ['progress' => 50])->assertOk();
        $this->putJson("/api/worksites/{$id}/lots/{$lots[1]['id']}/progress", ['progress' => 100])
            ->assertOk()
            // (300 000 × 50 + 100 000 × 100) / 400 000 = 62,5 → 63 %.
            ->assertJsonPath('data.progress', 63);
        $this->putJson("/api/worksites/{$id}/lots/{$lots[0]['id']}/progress", ['progress' => 120])->assertJsonValidationErrors('progress');

        $this->assertContains('Carrelage : avancement 0 % → 50 %.', collect($this->getJson("/api/worksites/{$id}")->json('data.logs'))->pluck('body'));
    }

    public function test_photos_are_dated_located_private_and_never_duplicated(): void
    {
        $id = $this->acceptedWorksite();
        $uuid = (string) Str::uuid();
        $payload = [
            'photo' => UploadedFile::fake()->image('dalle.jpg', 2000, 1500),
            'taken_at' => '2026-10-12 09:30:00',
            'latitude' => 14.7167,
            'longitude' => -17.4677,
            'caption' => 'Coulage de la dalle',
            'client_uuid' => $uuid,
        ];

        $this->post("/api/worksites/{$id}/photos", $payload, ['Accept' => 'application/json'])->assertCreated();
        // Même envoi relancé après une coupure : pas de doublon.
        $this->post("/api/worksites/{$id}/photos", [...$payload, 'photo' => UploadedFile::fake()->image('dalle.jpg')], ['Accept' => 'application/json'])->assertOk();

        $this->assertSame(1, WorksitePhoto::count());
        $photo = $this->getJson("/api/worksites/{$id}")->assertJsonPath('data.photos.0.latitude', 14.7167)->json('data.photos.0');
        Storage::disk('local')->assertExists(WorksitePhoto::first()->path);
        $this->get('/api'.$photo['url'])->assertOk();

        Sanctum::actingAs(User::factory()->withRoles(Role::Agent)->create());
        $this->get('/api'.$photo['url'])->assertForbidden();
    }

    public function test_the_tracking_link_is_renewed_and_revoked(): void
    {
        $id = $this->acceptedWorksite();

        $first = $this->postJson("/api/worksites/{$id}/tracking")->assertOk()->json('data.tracking_token');
        $second = $this->postJson("/api/worksites/{$id}/tracking")->assertOk()->json('data.tracking_token');
        $this->assertNotSame($first, $second);
        $this->assertSame(48, strlen($second));

        $this->deleteJson("/api/worksites/{$id}/tracking")->assertOk()->assertJsonPath('data.tracking_token', null);
    }

    public function test_budgets_are_only_seen_and_set_with_the_costs_permission(): void
    {
        $id = $this->acceptedWorksite();
        $this->putJson("/api/worksites/{$id}", ['budget_materials' => 150_000, 'budget_labor' => 80_000])
            ->assertOk()
            ->assertJsonPath('data.budget.total', 230_000);

        $commercial = User::factory()->withRoles(Role::Commercial)->create();
        Sanctum::actingAs($commercial);
        $this->getJson("/api/worksites/{$id}")->assertOk()->assertJsonMissingPath('data.budget');
        $this->putJson("/api/worksites/{$id}", ['manager_id' => $commercial->id])->assertForbidden();
        $this->assertNull(Worksite::find($id)->manager_id);
    }
}
