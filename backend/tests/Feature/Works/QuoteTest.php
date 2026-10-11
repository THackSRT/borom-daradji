<?php

namespace Tests\Feature\Works;

use App\Enums\Role;
use App\Models\CatalogItem;
use App\Models\Client;
use App\Models\Quote;
use App\Models\Trade;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class QuoteTest extends TestCase
{
    use RefreshDatabase;

    private User $manager;

    private Client $client;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-10-12');
        User::factory()->dirigeant()->create();
        $this->manager = User::factory()->withRoles(Role::ResponsableTravaux)->create();
        $this->client = Client::factory()->create(['name' => 'Moussa Diop']);
        Sanctum::actingAs($this->manager);
    }

    /**
     * Deux lots : carrelage (25 m² à 9 500, TVA 18 %) et plomberie (forfait 180 000, TVA 18 %).
     *
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return [
            'client_id' => $this->client->id,
            'title' => 'Rénovation de la salle de bain',
            'site_address' => 'Sacré-Cœur 3, villa 120',
            'lots' => [
                ['title' => 'Carrelage', 'trade_id' => Trade::where('name', 'like', 'Carrelage%')->value('id'), 'lines' => [
                    ['designation' => 'Pose de carrelage au sol', 'unit' => 'm²', 'quantity' => 25, 'unit_price' => 9_500, 'vat_rate' => 18],
                ]],
                ['title' => 'Plomberie', 'lines' => [
                    ['designation' => 'Remplacement des sanitaires', 'unit' => 'forfait', 'quantity' => 1, 'unit_price' => 180_000, 'vat_rate' => 18],
                ]],
            ],
            ...$overrides,
        ];
    }

    public function test_default_trades_are_installed(): void
    {
        $this->getJson('/api/trades')->assertOk()->assertJsonCount(15, 'data')->assertJsonPath('data.0.name', 'Maçonnerie et gros œuvre');
    }

    public function test_a_quote_gets_a_number_and_totals_computed_by_lot(): void
    {
        $this->postJson('/api/quotes', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.number', 'DEV-2026-0001')
            ->assertJsonPath('data.status.value', 'brouillon')
            ->assertJsonPath('data.lots.0.total_ht', 237_500)
            ->assertJsonPath('data.lots.1.total_ht', 180_000)
            ->assertJsonPath('data.total_ht', 417_500)
            ->assertJsonPath('data.vat_total', 42_750 + 32_400)
            ->assertJsonPath('data.total', 417_500 + 75_150)
            // Acompte par défaut : 30 % du TTC.
            ->assertJsonPath('data.deposit_amount', (int) round(492_650 * 0.3));
    }

    public function test_the_discount_applies_line_by_line_before_vat(): void
    {
        $this->postJson('/api/quotes', $this->payload(['discount_rate' => 10]))
            ->assertCreated()
            ->assertJsonPath('data.subtotal', 417_500)
            ->assertJsonPath('data.discount_amount', 41_750)
            ->assertJsonPath('data.total_ht', 375_750)
            // TVA par ligne sur le montant remisé : 213 750 × 18 % + 162 000 × 18 %.
            ->assertJsonPath('data.vat_total', 38_475 + 29_160)
            ->assertJsonPath('data.lots.0.lines.0.net_amount', 213_750);
    }

    public function test_sending_sets_the_validity_and_offers_a_whatsapp_message(): void
    {
        $id = $this->postJson('/api/quotes', $this->payload())->json('data.id');

        $this->postJson("/api/quotes/{$id}/send")
            ->assertOk()
            ->assertJsonPath('data.status.value', 'envoye')
            ->assertJsonPath('data.issue_date', '2026-10-12')
            ->assertJsonPath('data.valid_until', '2026-11-11')
            ->assertJsonPath('data.can.update', false);
        $this->assertStringContainsString('wa.me', $this->getJson("/api/quotes/{$id}")->json('data.whatsapp_url'));

        // Un devis envoyé ne se modifie plus ; on le reprend en brouillon pour le corriger.
        $this->putJson("/api/quotes/{$id}", ['title' => 'Autre'])->assertJsonValidationErrors('quote');
        $this->postJson("/api/quotes/{$id}/reopen")->assertOk()->assertJsonPath('data.status.value', 'brouillon')->assertJsonPath('data.valid_until', null);
    }

    public function test_an_empty_quote_cannot_be_sent(): void
    {
        $id = $this->postJson('/api/quotes', $this->payload(['lots' => []]))->json('data.id');

        $this->postJson("/api/quotes/{$id}/send")->assertJsonValidationErrors('quote');
    }

    public function test_sent_quotes_expire_after_their_validity(): void
    {
        $id = $this->postJson('/api/quotes', $this->payload())->json('data.id');
        $this->postJson("/api/quotes/{$id}/send")->assertOk();

        Carbon::setTestNow('2026-11-11');
        $this->artisan('borom:expire-quotes')->assertSuccessful();
        $this->assertSame('envoye', Quote::find($id)->status->value);

        Carbon::setTestNow('2026-11-12');
        $this->artisan('borom:expire-quotes')->assertSuccessful();
        $this->assertSame('expire', Quote::find($id)->status->value);

        // Expiré : on ne l'accepte pas, on le renvoie (nouvelle validité).
        $this->postJson("/api/quotes/{$id}/accept")->assertJsonValidationErrors('quote');
        $this->postJson("/api/quotes/{$id}/send")->assertOk()->assertJsonPath('data.valid_until', '2026-12-12');
    }

    public function test_a_refused_quote_keeps_its_reason(): void
    {
        $id = $this->postJson('/api/quotes', $this->payload())->json('data.id');
        $this->postJson("/api/quotes/{$id}/send");

        $this->postJson("/api/quotes/{$id}/refuse", [])->assertJsonValidationErrors('reason');
        $this->postJson("/api/quotes/{$id}/refuse", ['reason' => 'Trop cher'])
            ->assertOk()
            ->assertJsonPath('data.status.value', 'refuse')
            ->assertJsonPath('data.refusal_reason', 'Trop cher');
    }

    public function test_a_template_is_reused_for_a_new_client(): void
    {
        $template = $this->postJson('/api/quotes', $this->payload(['is_template' => true, 'template_name' => 'Salle de bain standard', 'client_id' => null]))
            ->assertCreated()
            ->assertJsonPath('data.number', null)
            ->json('data.id');

        $this->getJson('/api/quotes?templates=1')->assertJsonCount(1, 'data');
        $this->getJson('/api/quotes')->assertJsonCount(0, 'data');
        $this->postJson("/api/quotes/{$template}/send")->assertJsonValidationErrors('quote');

        $other = Client::factory()->create();
        $this->postJson('/api/quotes', ['source_id' => $template])->assertJsonValidationErrors('client_id');
        $this->postJson('/api/quotes', ['source_id' => $template, 'client_id' => $other->id])
            ->assertCreated()
            ->assertJsonPath('data.number', 'DEV-2026-0001')
            ->assertJsonPath('data.client.id', $other->id)
            ->assertJsonPath('data.total', 492_650)
            ->assertJsonCount(2, 'data.lots');
    }

    public function test_catalog_lines_are_copied_so_later_price_changes_do_not_alter_the_quote(): void
    {
        $item = CatalogItem::create(['trade_id' => Trade::first()->id, 'designation' => 'Mur en agglos de 15', 'unit' => 'm²', 'unit_price' => 12_000]);
        $id = $this->postJson('/api/quotes', $this->payload(['lots' => [['title' => 'Maçonnerie', 'lines' => [
            ['catalog_item_id' => $item->id, 'designation' => $item->designation, 'unit' => 'm²', 'quantity' => 10, 'unit_price' => 12_000, 'vat_rate' => 18],
        ]]]]))->json('data.id');

        $this->putJson("/api/catalog-items/{$item->id}", ['unit_price' => 14_000])->assertOk()->assertJsonPath('data.unit_price', 14_000);

        $this->assertSame(120_000, Quote::find($id)->total_ht);
    }

    public function test_the_quote_pdf_is_generated(): void
    {
        $id = $this->postJson('/api/quotes', $this->payload(['discount_rate' => 5]))->json('data.id');

        $this->get("/api/quotes/{$id}/pdf")->assertOk()->assertHeader('content-type', 'application/pdf');
    }

    public function test_permissions_separate_quotes_catalog_and_templates(): void
    {
        Sanctum::actingAs(User::factory()->withRoles(Role::Commercial)->create());
        $this->postJson('/api/quotes', $this->payload())->assertCreated();
        $this->postJson('/api/quotes', $this->payload(['is_template' => true, 'client_id' => null]))->assertForbidden();
        $this->postJson('/api/catalog-items', ['trade_id' => Trade::first()->id, 'designation' => 'X', 'unit' => 'u', 'unit_price' => 1])->assertForbidden();
        $this->getJson('/api/catalog-items')->assertOk();

        Sanctum::actingAs(User::factory()->withRoles(Role::Agent)->create());
        $this->getJson('/api/quotes')->assertForbidden();
    }
}
