<?php

namespace Tests\Feature\Billing;

use App\Enums\Role;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\User;
use App\Services\Billing;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CashSessionTest extends TestCase
{
    use RefreshDatabase;

    private Invoice $invoice;

    protected function setUp(): void
    {
        parent::setUp();
        $comptable = User::factory()->withRoles(Role::Comptable)->create();
        $this->invoice = Billing::issue(Billing::saveDraft(
            new Invoice(['client_id' => Client::factory()->create()->id, 'activity' => 'location']),
            [],
            [['description' => 'Loyer', 'quantity' => 1, 'unit_price' => 500_000]],
        ), $comptable);
    }

    private function cashier(): User
    {
        $user = User::factory()->withRoles(Role::Agent)->create();
        Sanctum::actingAs($user);

        return $user;
    }

    public function test_cash_payments_feed_the_expected_amount_of_the_day(): void
    {
        $this->cashier();
        $this->putJson('/api/cash-sessions/current', ['opening_amount' => 20_000])->assertOk();
        $this->postJson("/api/invoices/{$this->invoice->id}/payments", ['method' => 'especes', 'amount' => 150_000]);
        $this->postJson("/api/invoices/{$this->invoice->id}/payments", ['method' => 'wave', 'amount' => 100_000, 'reference' => 'W-1']);
        $this->postJson('/api/cash-sessions/current/movements', ['type' => 'depense', 'amount' => 5_000, 'label' => 'Crédit téléphone']);

        $this->getJson('/api/cash-sessions/current')
            ->assertOk()
            ->assertJsonPath('data.cash_in', 150_000)
            ->assertJsonPath('data.movements_total', -5_000)
            // 20 000 + 150 000 − 5 000 ; le paiement Wave n'est pas dans la caisse.
            ->assertJsonPath('data.expected_amount', 165_000)
            ->assertJsonPath('data.other_methods.0.method.value', 'wave')
            ->assertJsonPath('data.other_methods.0.total', 100_000);
    }

    public function test_cash_out_cannot_exceed_what_is_in_the_till(): void
    {
        $this->cashier();
        $this->postJson("/api/invoices/{$this->invoice->id}/payments", ['method' => 'especes', 'amount' => 50_000]);

        $this->postJson('/api/cash-sessions/current/movements', ['type' => 'depot_banque', 'amount' => 60_000, 'label' => 'Dépôt CBAO'])
            ->assertJsonValidationErrors('amount');
    }

    public function test_closing_records_the_difference_which_must_be_explained(): void
    {
        $this->cashier();
        $this->postJson("/api/invoices/{$this->invoice->id}/payments", ['method' => 'especes', 'amount' => 100_000]);
        $id = $this->getJson('/api/cash-sessions/current')->json('data.id');

        $this->postJson("/api/cash-sessions/{$id}/close", ['counted_amount' => 98_000])->assertJsonValidationErrors('closing_note');

        $this->postJson("/api/cash-sessions/{$id}/close", ['counted_amount' => 98_000, 'closing_note' => 'Monnaie rendue en trop'])
            ->assertOk()
            ->assertJsonPath('data.expected_amount', 100_000)
            ->assertJsonPath('data.difference', -2_000);
    }

    public function test_closed_till_accepts_no_more_cash_and_payments_can_no_longer_be_cancelled(): void
    {
        $this->cashier();
        $this->postJson("/api/invoices/{$this->invoice->id}/payments", ['method' => 'especes', 'amount' => 100_000]);
        $id = $this->getJson('/api/cash-sessions/current')->json('data.id');
        $this->postJson("/api/cash-sessions/{$id}/close", ['counted_amount' => 100_000])->assertOk();

        $this->postJson("/api/invoices/{$this->invoice->id}/payments", ['method' => 'especes', 'amount' => 10_000])->assertJsonValidationErrors('method');
        // Le mobile money ne passe pas par la caisse : toujours possible.
        $this->postJson("/api/invoices/{$this->invoice->id}/payments", ['method' => 'wave', 'amount' => 10_000, 'reference' => 'W-9'])->assertOk();
        $this->postJson('/api/cash-sessions/current/movements', ['type' => 'apport', 'amount' => 1_000, 'label' => 'Monnaie'])->assertJsonValidationErrors('session');

        Sanctum::actingAs(User::factory()->withRoles(Role::Comptable)->create());
        $payment = $this->invoice->payments()->where('method', 'especes')->first();
        $this->postJson("/api/payments/{$payment->id}/cancel", ['reason' => 'Erreur de saisie'])->assertJsonValidationErrors('payment');
    }

    public function test_each_person_sees_their_own_till_and_the_accountant_sees_all(): void
    {
        $this->cashier();
        $this->postJson("/api/invoices/{$this->invoice->id}/payments", ['method' => 'especes', 'amount' => 10_000]);
        $mine = $this->getJson('/api/cash-sessions/current')->json('data.id');

        $this->cashier();
        $this->getJson("/api/cash-sessions/{$mine}")->assertForbidden();
        $this->postJson("/api/cash-sessions/{$mine}/close", ['counted_amount' => 10_000])->assertForbidden();

        Sanctum::actingAs(User::factory()->withRoles(Role::Comptable)->create());
        $this->getJson('/api/cash-sessions?date='.today()->toDateString())->assertJsonCount(1, 'data');
        $this->postJson("/api/cash-sessions/{$mine}/close", ['counted_amount' => 10_000])->assertOk();

        Sanctum::actingAs(User::factory()->withRoles(Role::ResponsableTravaux)->create());
        $this->getJson('/api/cash-sessions/current')->assertForbidden();
    }
}
