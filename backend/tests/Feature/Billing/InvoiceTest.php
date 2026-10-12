<?php

namespace Tests\Feature\Billing;

use App\Enums\Role;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InvoiceTest extends TestCase
{
    use RefreshDatabase;

    private function comptable(): User
    {
        $user = User::factory()->withRoles(Role::Comptable)->create();
        Sanctum::actingAs($user);

        return $user;
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return [
            'client_id' => Client::factory()->create(['name' => 'Fatou Sow'])->id,
            'activity' => 'immobilier',
            'lines' => [
                ['description' => 'Commission de vente — villa Almadies', 'quantity' => 1, 'unit_price' => 1_500_000, 'vat_rate' => 18],
                ['description' => 'Frais de dossier', 'quantity' => 2.5, 'unit_price' => 10_001, 'vat_rate' => 0],
            ],
            ...$overrides,
        ];
    }

    public function test_totals_are_computed_by_the_server_and_rounded_to_the_franc(): void
    {
        $this->comptable();

        $this->postJson('/api/invoices', [...$this->payload(), 'total' => 1])
            ->assertCreated()
            ->assertJsonPath('data.status.value', 'brouillon')
            ->assertJsonPath('data.number', null)
            // 2,5 × 10 001 = 25 002,5 → 25 003 ; TVA 18 % de 1 500 000 = 270 000.
            ->assertJsonPath('data.lines.1.amount', 25_003)
            ->assertJsonPath('data.subtotal', 1_525_003)
            ->assertJsonPath('data.vat_total', 270_000)
            ->assertJsonPath('data.total', 1_795_003);
    }

    public function test_number_is_given_at_issue_without_gaps_even_when_a_draft_is_deleted(): void
    {
        $user = $this->comptable();

        $first = $this->postJson('/api/invoices', $this->payload())->json('data.id');
        $abandoned = $this->postJson('/api/invoices', $this->payload())->json('data.id');
        $third = $this->postJson('/api/invoices', $this->payload())->json('data.id');

        $this->deleteJson("/api/invoices/{$abandoned}")->assertNoContent();

        $year = now()->year;
        $this->postJson("/api/invoices/{$third}/issue")
            ->assertOk()
            ->assertJsonPath('data.number', "FAC-{$year}-00001")
            ->assertJsonPath('data.status.value', 'emise')
            ->assertJsonPath('data.issue_date', today()->toDateString())
            ->assertJsonPath('data.due_date', today()->addDays(15)->toDateString())
            ->assertJsonPath('data.payment_state.value', 'non_payee');

        $this->postJson("/api/invoices/{$first}/issue")->assertJsonPath('data.number', "FAC-{$year}-00002");
        $this->assertSame($user->id, Invoice::find($first)->issued_by);
    }

    public function test_issued_invoice_can_neither_be_modified_nor_deleted(): void
    {
        $this->comptable();
        $id = $this->postJson('/api/invoices', $this->payload())->json('data.id');
        $this->postJson("/api/invoices/{$id}/issue")->assertOk();

        $this->putJson("/api/invoices/{$id}", $this->payload())
            ->assertUnprocessable()
            ->assertJsonValidationErrors('invoice');
        $this->deleteJson("/api/invoices/{$id}")->assertJsonValidationErrors('invoice');
        $this->postJson("/api/invoices/{$id}/issue")->assertJsonValidationErrors('invoice');

        $this->assertNotNull(Invoice::find($id));
    }

    public function test_an_invoice_needs_lines_and_an_amount(): void
    {
        $this->comptable();

        $this->postJson('/api/invoices', $this->payload(['lines' => []]))->assertJsonValidationErrors('lines');

        $id = $this->postJson('/api/invoices', $this->payload(['lines' => [
            ['description' => 'Geste commercial', 'quantity' => 1, 'unit_price' => 0],
        ]]))->json('data.id');

        $this->postJson("/api/invoices/{$id}/issue")->assertJsonValidationErrors('invoice');
    }

    public function test_credit_note_corrects_an_invoice_within_its_amount(): void
    {
        $this->comptable();
        $id = $this->postJson('/api/invoices', $this->payload(['lines' => [
            ['description' => 'Loyer octobre', 'quantity' => 1, 'unit_price' => 300_000, 'vat_rate' => 0],
        ]]))->json('data.id');
        $this->postJson("/api/invoices/{$id}/issue");

        // Avoir partiel : 100 000.
        $note = $this->postJson("/api/invoices/{$id}/credit-notes")
            ->assertCreated()
            ->assertJsonPath('data.type.value', 'avoir')
            ->assertJsonPath('data.total', 300_000)
            ->json('data.id');
        $this->putJson("/api/invoices/{$note}", [
            'activity' => 'location',
            'lines' => [['description' => 'Remise sur loyer octobre', 'quantity' => 1, 'unit_price' => 100_000]],
        ])->assertOk();
        $this->postJson("/api/invoices/{$note}/issue")
            ->assertOk()
            ->assertJsonPath('data.number', 'AV-'.now()->year.'-00001')
            ->assertJsonPath('data.due_date', null);

        $this->getJson("/api/invoices/{$id}")
            ->assertJsonPath('data.credited_total', 100_000)
            ->assertJsonPath('data.balance', 200_000);

        // Un second avoir de 300 000 dépasserait le reste créditable (200 000).
        $second = $this->postJson("/api/invoices/{$id}/credit-notes")->json('data.id');
        $this->postJson("/api/invoices/{$second}/issue")->assertJsonValidationErrors('invoice');
    }

    public function test_fully_credited_invoice_is_shown_as_cancelled(): void
    {
        $this->comptable();
        $id = $this->postJson('/api/invoices', $this->payload())->json('data.id');
        $this->postJson("/api/invoices/{$id}/issue");
        $note = $this->postJson("/api/invoices/{$id}/credit-notes")->json('data.id');
        $this->postJson("/api/invoices/{$note}/issue")->assertOk();

        $this->getJson("/api/invoices/{$id}")
            ->assertJsonPath('data.payment_state.value', 'annulee')
            ->assertJsonPath('data.balance', 0)
            ->assertJsonPath('data.can.credit', false);
        $this->postJson("/api/invoices/{$id}/credit-notes")->assertJsonValidationErrors('invoice');
    }

    public function test_credit_note_keeps_the_client_of_the_original_invoice(): void
    {
        $this->comptable();
        $id = $this->postJson('/api/invoices', $this->payload())->json('data.id');
        $this->postJson("/api/invoices/{$id}/issue");
        $note = $this->postJson("/api/invoices/{$id}/credit-notes")->json('data.id');

        $this->putJson("/api/invoices/{$note}", [...$this->payload(), 'client_id' => Client::factory()->create()->id])
            ->assertJsonValidationErrors('client_id');
    }

    public function test_agents_see_and_cash_invoices_but_only_the_accountant_prepares_them(): void
    {
        $this->comptable();
        $id = $this->postJson('/api/invoices', $this->payload())->json('data.id');

        Sanctum::actingAs(User::factory()->withRoles(Role::Agent)->create());
        $this->getJson('/api/invoices')->assertOk();
        $this->postJson('/api/invoices', $this->payload())->assertForbidden();
        $this->postJson("/api/invoices/{$id}/issue")->assertForbidden();

        Sanctum::actingAs(User::factory()->withRoles(Role::ResponsableTravaux)->create());
        $this->getJson('/api/invoices')->assertForbidden();
    }

    public function test_list_filters_overdue_invoices_and_sums_what_remains_to_collect(): void
    {
        $this->comptable();
        $late = $this->postJson('/api/invoices', $this->payload(['due_date' => today()->subDays(3)->toDateString(), 'issue_date' => today()->subDays(20)->toDateString()]))->json('data.id');
        $this->postJson("/api/invoices/{$late}/issue");
        $current = $this->postJson('/api/invoices', $this->payload())->json('data.id');
        $this->postJson("/api/invoices/{$current}/issue");
        $this->postJson('/api/invoices', $this->payload());

        $this->getJson('/api/invoices?state=en_retard')
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $late)
            ->assertJsonPath('data.0.is_overdue', true)
            ->assertJsonPath('summary.outstanding', 2 * 1_795_003)
            ->assertJsonPath('summary.overdue', 1_795_003)
            ->assertJsonPath('summary.drafts', 1);
    }

    public function test_pdf_is_generated_for_drafts_and_issued_invoices(): void
    {
        $this->comptable();
        $id = $this->postJson('/api/invoices', $this->payload())->json('data.id');

        $this->get("/api/invoices/{$id}/pdf")->assertOk()->assertHeader('content-type', 'application/pdf');

        $this->postJson("/api/invoices/{$id}/issue");
        $response = $this->get("/api/invoices/{$id}/pdf")->assertOk();
        $this->assertStringContainsString('FAC-'.now()->year.'-00001.pdf', $response->headers->get('content-disposition'));
        $this->assertDatabaseHas('activity_logs', ['action' => 'downloaded', 'subject_type' => 'invoice', 'subject_id' => $id]);
    }

    public function test_whatsapp_reminder_states_the_amount_due(): void
    {
        $this->comptable();
        $payload = $this->payload();
        Client::find($payload['client_id'])->update(['phone' => '77 123 45 67']);
        $id = $this->postJson('/api/invoices', $payload)->json('data.id');
        $this->postJson("/api/invoices/{$id}/issue");

        $url = $this->getJson("/api/invoices/{$id}")->json('data.whatsapp_reminder_url');

        $this->assertStringStartsWith('https://wa.me/221771234567?text=', $url);
        $this->assertStringContainsString(rawurlencode('1 795 003 FCFA'), $url);
    }
}
