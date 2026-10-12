<?php

namespace Tests\Feature\Works;

use App\Enums\Role;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\User;
use App\Models\Worksite;
use App\Services\Billing;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WorksiteTrackingTest extends TestCase
{
    use RefreshDatabase;

    private User $director;

    private Worksite $worksite;

    private string $token;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-10-12');
        Storage::fake('local');
        $this->director = User::factory()->dirigeant()->create();
        Sanctum::actingAs($this->director);

        $quote = $this->postJson('/api/quotes', ['client_id' => Client::factory()->create(['name' => 'Mariama Sy'])->id, 'title' => 'Extension', 'deposit_rate' => 30, 'lots' => [
            ['title' => 'Gros œuvre', 'lines' => [['designation' => 'Murs', 'quantity' => 1, 'unit_price' => 300_000, 'vat_rate' => 18]]],
            ['title' => 'Peinture', 'lines' => [['designation' => 'Peinture', 'quantity' => 1, 'unit_price' => 100_000, 'vat_rate' => 18]]],
        ]])->json('data.id');
        $this->postJson("/api/quotes/{$quote}/send")->assertOk();
        $this->worksite = Worksite::findOrFail($this->postJson("/api/quotes/{$quote}/accept")->json('data.worksite.id'));
        $this->postJson("/api/worksites/{$this->worksite->id}/status", ['status' => 'en_cours'])->assertOk();
        $this->token = $this->postJson("/api/worksites/{$this->worksite->id}/tracking")->assertOk()->json('data.tracking_token');
    }

    public function test_the_client_sees_progress_public_logs_photos_and_payments_without_an_account(): void
    {
        $lot = $this->worksite->lots()->orderBy('position')->first();
        $this->putJson("/api/worksites/{$this->worksite->id}/lots/{$lot->id}/progress", ['progress' => 50])->assertOk();
        $this->postJson("/api/worksites/{$this->worksite->id}/logs", ['body' => 'Dalle coulée.', 'is_public' => true])->assertSuccessful();
        $this->postJson("/api/worksites/{$this->worksite->id}/logs", ['body' => 'Retard du fournisseur, à négocier.', 'is_public' => false])->assertSuccessful();
        $public = $this->post("/api/worksites/{$this->worksite->id}/photos", ['photo' => UploadedFile::fake()->image('a.jpg'), 'is_public' => 1])->json('data.id');
        $private = $this->post("/api/worksites/{$this->worksite->id}/photos", ['photo' => UploadedFile::fake()->image('b.jpg'), 'is_public' => 0])->json('data.id');

        // Acompte émis et payé, une situation en brouillon (invisible pour le client).
        $deposit = Billing::issue(Invoice::findOrFail($this->postJson("/api/worksites/{$this->worksite->id}/invoices", ['kind' => 'acompte'])->json('data.id')), $this->director);
        Billing::recordPayment($deposit, ['method' => 'virement', 'amount' => 100_000, 'reference' => 'VIR-1'], $this->director);
        $this->postJson("/api/worksites/{$this->worksite->id}/invoices", ['kind' => 'situation'])->assertCreated();
        $this->postJson("/api/worksites/{$this->worksite->id}/cash", ['kind' => 'depense', 'category' => 'materiaux', 'amount' => 50_000, 'label' => 'Ciment'])->assertCreated();

        $this->app['auth']->forgetGuards();
        $response = $this->getJson("/api/public/worksites/{$this->token}")
            ->assertOk()
            ->assertHeader('X-Robots-Tag', 'noindex, nofollow')
            ->assertJsonPath('data.reference', $this->worksite->reference)
            ->assertJsonPath('data.status.value', 'en_cours')
            ->assertJsonPath('data.progress', 38)
            ->assertJsonPath('data.lots.0.progress', 50)
            ->assertJsonCount(1, 'data.photos')
            ->assertJsonPath('data.photos.0.id', $public)
            ->assertJsonPath('data.billing.contract_total', 472_000)
            ->assertJsonPath('data.billing.invoiced_total', 141_600)
            ->assertJsonPath('data.billing.paid_total', 100_000)
            ->assertJsonPath('data.billing.balance', 41_600)
            ->assertJsonCount(1, 'data.billing.invoices');

        $bodies = collect($response->json('data.logs'))->pluck('body');
        $this->assertContains('Dalle coulée.', $bodies);
        $this->assertNotContains('Retard du fournisseur, à négocier.', $bodies);
        // Rien d'interne : ni budget, ni caisse, ni tâcherons.
        $this->assertStringNotContainsString('Ciment', $response->getContent());
        $this->assertStringNotContainsString('budget', $response->getContent());

        $this->get("/api/public/worksites/{$this->token}/photos/{$public}")->assertOk();
        $this->get("/api/public/worksites/{$this->token}/photos/{$private}")->assertNotFound();
        $this->get("/api/public/worksites/{$this->token}/invoices/{$deposit->id}/pdf")->assertOk()->assertHeader('content-type', 'application/pdf');
    }

    public function test_a_revoked_or_renewed_link_stops_working_and_invoices_of_other_worksites_are_hidden(): void
    {
        $other = Billing::issue(Billing::saveDraft(new Invoice(['client_id' => Client::factory()->create()->id, 'activity' => 'travaux']), [], [['description' => 'X', 'quantity' => 1, 'unit_price' => 1_000]]), $this->director);
        $this->get("/api/public/worksites/{$this->token}/invoices/{$other->id}/pdf")->assertNotFound();

        $new = $this->postJson("/api/worksites/{$this->worksite->id}/tracking")->json('data.tracking_token');
        $this->getJson("/api/public/worksites/{$this->token}")->assertNotFound();
        $this->getJson("/api/public/worksites/{$new}")->assertOk();

        $this->deleteJson("/api/worksites/{$this->worksite->id}/tracking")->assertOk();
        $this->getJson("/api/public/worksites/{$new}")->assertNotFound();
        $this->getJson('/api/public/worksites/court')->assertNotFound();
    }

    public function test_tracking_link_management_requires_the_manage_permission(): void
    {
        Sanctum::actingAs(User::factory()->withRoles(Role::Comptable)->create());
        $this->postJson("/api/worksites/{$this->worksite->id}/tracking")->assertForbidden();
        $this->getJson("/api/worksites/{$this->worksite->id}")->assertJsonMissingPath('data.tracking_token');
    }
}
