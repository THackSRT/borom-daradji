<?php

namespace Tests\Feature\Works;

use App\Enums\Role;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\User;
use App\Models\Worksite;
use App\Services\Billing;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WorksBillingTest extends TestCase
{
    use RefreshDatabase;

    private User $director;

    private Worksite $worksite;

    protected function setUp(): void
    {
        parent::setUp();
        $this->director = User::factory()->dirigeant()->create();
        Sanctum::actingAs($this->director);
        $this->worksite = $this->worksiteFrom([
            ['title' => 'Carrelage', 'lines' => [['designation' => 'Pose', 'unit' => 'm²', 'quantity' => 30, 'unit_price' => 10_000, 'vat_rate' => 18]]],
            ['title' => 'Plomberie', 'lines' => [['designation' => 'Sanitaires', 'unit' => 'forfait', 'quantity' => 1, 'unit_price' => 100_000, 'vat_rate' => 18]]],
        ]);
    }

    /**
     * @param  list<array<string, mixed>>  $lots
     */
    private function worksiteFrom(array $lots): Worksite
    {
        $quote = $this->postJson('/api/quotes', ['client_id' => Client::factory()->create()->id, 'title' => 'Travaux', 'deposit_rate' => 30, 'lots' => $lots])->json('data.id');
        $this->postJson("/api/quotes/{$quote}/send")->assertOk();
        $id = $this->postJson("/api/quotes/{$quote}/accept")->assertOk()->json('data.worksite.id');
        $this->postJson("/api/worksites/{$id}/status", ['status' => 'en_cours'])->assertOk();

        return Worksite::findOrFail($id);
    }

    private function progress(int $lotIndex, int $progress): void
    {
        $lot = $this->worksite->lots()->orderBy('position')->get()[$lotIndex];
        $this->putJson("/api/worksites/{$this->worksite->id}/lots/{$lot->id}/progress", ['progress' => $progress])->assertOk();
    }

    /**
     * Prépare la facture et l'émet ; renvoie la facture.
     *
     * @param  array<string, mixed>  $extra
     */
    private function invoice(string $kind, array $extra = []): Invoice
    {
        $id = $this->postJson("/api/worksites/{$this->worksite->id}/invoices", ['kind' => $kind, ...$extra])->assertCreated()->json('data.id');

        return Billing::issue(Invoice::findOrFail($id), $this->director);
    }

    public function test_deposit_situations_and_balance_add_up_to_the_contract(): void
    {
        // Acompte de 30 % du marché HT (400 000).
        $deposit = $this->invoice('acompte');
        $this->assertSame(120_000, $deposit->subtotal);
        $this->assertSame(141_600, $deposit->total);
        $this->assertSame('travaux', $deposit->activity->value);

        // Situation 1 : carrelage 50 %, plomberie 100 % → 250 000 réalisés, acompte déduit 75 000.
        $this->progress(0, 50);
        $this->progress(1, 100);
        $first = $this->invoice('situation');
        $this->assertSame(250_000 - 75_000, $first->subtotal);
        $this->assertStringContainsString('Situation n° 1', $first->notes);
        $this->assertSame([150_000, 100_000, -75_000], $first->lines->pluck('unit_price')->all());

        // Rien de nouveau : pas de situation.
        $this->postJson("/api/worksites/{$this->worksite->id}/invoices", ['kind' => 'situation'])->assertJsonValidationErrors('kind');

        // Situation 2 : carrelage 80 % → 90 000 de plus, déduction 102 000 − 75 000.
        $this->progress(0, 80);
        $second = $this->invoice('situation');
        $this->assertSame(90_000 - 27_000, $second->subtotal);

        // Solde : seulement une fois le chantier terminé ; il passe alors en « facturé ».
        $this->postJson("/api/worksites/{$this->worksite->id}/invoices", ['kind' => 'solde'])->assertJsonValidationErrors('kind');
        $this->postJson("/api/worksites/{$this->worksite->id}/status", ['status' => 'termine'])->assertOk();
        $balance = $this->invoice('solde');
        $this->assertSame(60_000 - 18_000, $balance->subtotal);
        $this->assertSame('facture', $this->worksite->fresh()->status->value);

        // Tout le marché est facturé, au franc près.
        $this->assertSame(400_000, $deposit->subtotal + $first->subtotal + $second->subtotal + $balance->subtotal);
        $this->getJson("/api/worksites/{$this->worksite->id}/billing")
            ->assertOk()
            ->assertJsonPath('data.billed_work_ht', 400_000)
            ->assertJsonPath('data.remaining_ht', 0)
            ->assertJsonPath('data.deposits_deducted_ht', 120_000)
            ->assertJsonPath('data.invoiced_total', 472_000)
            ->assertJsonCount(4, 'data.invoices')
            ->assertJsonPath('data.invoices.2.kind.label', 'Situation n° 2');
    }

    public function test_one_draft_at_a_time_and_abandoned_drafts_do_not_count(): void
    {
        $this->progress(0, 50);
        $draft = $this->postJson("/api/worksites/{$this->worksite->id}/invoices", ['kind' => 'situation'])->assertCreated()->json('data.id');

        $this->postJson("/api/worksites/{$this->worksite->id}/invoices", ['kind' => 'situation'])->assertJsonValidationErrors('kind');
        $this->getJson("/api/worksites/{$this->worksite->id}/billing")->assertJsonPath('data.blocking_draft.id', $draft);

        $this->deleteJson("/api/invoices/{$draft}")->assertNoContent();
        $this->postJson("/api/worksites/{$this->worksite->id}/invoices", ['kind' => 'situation'])
            ->assertCreated()
            ->assertJsonPath('data.total', 177_000);
    }

    public function test_the_deposit_comes_before_the_first_situation_and_within_the_contract(): void
    {
        $this->postJson("/api/worksites/{$this->worksite->id}/invoices", ['kind' => 'acompte', 'deposit_rate' => 120])->assertJsonValidationErrors('deposit_rate');

        $this->progress(0, 50);
        $this->invoice('situation');
        $this->postJson("/api/worksites/{$this->worksite->id}/invoices", ['kind' => 'acompte'])->assertJsonValidationErrors('kind');
    }

    public function test_the_preview_shows_the_lines_without_creating_anything(): void
    {
        $this->progress(1, 50);

        $this->getJson("/api/worksites/{$this->worksite->id}/invoices/preview?kind=situation")
            ->assertOk()
            ->assertJsonPath('data.total_ht', 50_000)
            ->assertJsonPath('data.sequence', 1)
            ->assertJsonPath('data.lines.0.vat_rate', 18);
        $this->assertSame(0, Invoice::count());
    }

    public function test_vat_follows_the_rates_of_each_lot(): void
    {
        $this->worksite = $this->worksiteFrom([
            ['title' => 'Mixte', 'lines' => [
                ['designation' => 'Main-d\'œuvre', 'quantity' => 1, 'unit_price' => 300_000, 'vat_rate' => 18],
                ['designation' => 'Fourniture exonérée', 'quantity' => 1, 'unit_price' => 100_000, 'vat_rate' => 0],
            ]],
        ]);
        $this->progress(0, 50);

        $invoice = $this->invoice('situation');

        $this->assertEqualsCanonicalizing([[150_000, 18.0], [50_000, 0.0]], $invoice->lines->map(fn ($l) => [$l->unit_price, (float) $l->vat_rate])->all());
        $this->assertSame(200_000 + 27_000, $invoice->total);
    }

    public function test_invoicing_requires_the_invoice_permission(): void
    {
        Sanctum::actingAs(User::factory()->withRoles(Role::ResponsableTravaux)->create());
        $this->getJson("/api/worksites/{$this->worksite->id}/billing")->assertOk()->assertJsonPath('data.can_invoice', false);
        $this->postJson("/api/worksites/{$this->worksite->id}/invoices", ['kind' => 'acompte'])->assertForbidden();

        Sanctum::actingAs(User::factory()->withRoles(Role::Comptable)->create());
        $this->postJson("/api/worksites/{$this->worksite->id}/invoices", ['kind' => 'acompte'])->assertCreated();
    }
}
