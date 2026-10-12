<?php

namespace Tests\Feature\Billing;

use App\Enums\Role;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\User;
use App\Services\Billing;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PaymentTest extends TestCase
{
    use RefreshDatabase;

    private function issuedInvoice(int $amount = 300_000): Invoice
    {
        $comptable = User::factory()->withRoles(Role::Comptable)->create();
        $invoice = Billing::saveDraft(
            new Invoice(['client_id' => Client::factory()->create()->id, 'activity' => 'location', 'created_by' => $comptable->id]),
            [],
            [['description' => 'Loyer', 'quantity' => 1, 'unit_price' => $amount, 'vat_rate' => 0]],
        );

        return Billing::issue($invoice, $comptable);
    }

    private function agent(): User
    {
        $user = User::factory()->withRoles(Role::Agent)->create();
        Sanctum::actingAs($user);

        return $user;
    }

    public function test_partial_payments_update_the_balance_until_the_invoice_is_paid(): void
    {
        $invoice = $this->issuedInvoice();
        $this->agent();

        $this->postJson("/api/invoices/{$invoice->id}/payments", ['method' => 'especes', 'amount' => 100_000])
            ->assertOk()
            ->assertJsonPath('data.paid_total', 100_000)
            ->assertJsonPath('data.balance', 200_000)
            ->assertJsonPath('data.payment_state.value', 'partielle')
            ->assertJsonPath('data.payments.0.number', 'REC-'.now()->year.'-00001');

        $this->postJson("/api/invoices/{$invoice->id}/payments", ['method' => 'wave', 'amount' => 200_000, 'reference' => 'T-8F2K1'])
            ->assertJsonPath('data.balance', 0)
            ->assertJsonPath('data.payment_state.value', 'payee')
            ->assertJsonPath('data.whatsapp_reminder_url', null);
    }

    public function test_overpayment_is_refused(): void
    {
        $invoice = $this->issuedInvoice();
        $this->agent();

        $this->postJson("/api/invoices/{$invoice->id}/payments", ['method' => 'especes', 'amount' => 300_001])
            ->assertJsonValidationErrors('amount');
    }

    public function test_mobile_money_needs_a_reference_that_is_not_recorded_twice(): void
    {
        $invoice = $this->issuedInvoice();
        $this->agent();

        $this->postJson("/api/invoices/{$invoice->id}/payments", ['method' => 'orange_money', 'amount' => 50_000])
            ->assertJsonValidationErrors('reference');

        $this->postJson("/api/invoices/{$invoice->id}/payments", ['method' => 'orange_money', 'amount' => 50_000, 'reference' => 'MP2410.1234.A'])->assertOk();
        $this->postJson("/api/invoices/{$invoice->id}/payments", ['method' => 'orange_money', 'amount' => 50_000, 'reference' => 'MP2410.1234.A'])
            ->assertJsonValidationErrors('reference');
    }

    public function test_draft_invoices_and_future_dates_cannot_be_cashed(): void
    {
        $invoice = $this->issuedInvoice();
        $draft = Billing::saveDraft(new Invoice(['client_id' => $invoice->client_id, 'activity' => 'autre']), [], [['description' => 'X', 'quantity' => 1, 'unit_price' => 1000]]);
        $this->agent();

        $this->postJson("/api/invoices/{$draft->id}/payments", ['method' => 'especes', 'amount' => 1000])->assertJsonValidationErrors('invoice');
        $this->postJson("/api/invoices/{$invoice->id}/payments", ['method' => 'especes', 'amount' => 1000, 'paid_on' => today()->addDay()->toDateString()])
            ->assertJsonValidationErrors('paid_on');
    }

    public function test_proof_screenshot_is_private_and_its_consultation_is_logged(): void
    {
        Storage::fake('local');
        $invoice = $this->issuedInvoice();
        $this->agent();

        $this->post("/api/invoices/{$invoice->id}/payments", [
            'method' => 'wave', 'amount' => 300_000, 'reference' => 'WV-778899',
            'proof' => UploadedFile::fake()->image('capture-wave.jpg'),
        ], ['Accept' => 'application/json'])->assertOk()->assertJsonPath('data.payments.0.has_proof', true);

        $payment = $invoice->payments()->first();
        Storage::disk('local')->assertExists($payment->proof_path);

        $this->get("/api/payments/{$payment->id}/proof")->assertOk();
        $this->assertDatabaseHas('activity_logs', ['action' => 'downloaded', 'subject_type' => 'payment', 'subject_id' => $payment->id]);
    }

    public function test_only_the_accountant_cancels_a_payment_with_a_reason(): void
    {
        $invoice = $this->issuedInvoice();
        $this->agent();
        $this->postJson("/api/invoices/{$invoice->id}/payments", ['method' => 'especes', 'amount' => 100_000]);
        $payment = $invoice->payments()->first();

        $this->postJson("/api/payments/{$payment->id}/cancel", ['reason' => 'Saisi deux fois'])->assertForbidden();

        Sanctum::actingAs(User::factory()->withRoles(Role::Comptable)->create());
        $this->postJson("/api/payments/{$payment->id}/cancel", [])->assertJsonValidationErrors('reason');
        $this->postJson("/api/payments/{$payment->id}/cancel", ['reason' => 'Saisi deux fois'])
            ->assertOk()
            ->assertJsonPath('data.cancel_reason', 'Saisi deux fois');

        $this->assertSame(0, $invoice->fresh()->paid_total);
        $this->assertDatabaseHas('payments', ['id' => $payment->id]);
    }

    public function test_receipt_pdf_is_available_to_whoever_received_the_payment(): void
    {
        $invoice = $this->issuedInvoice();
        $this->agent();
        $this->postJson("/api/invoices/{$invoice->id}/payments", ['method' => 'especes', 'amount' => 300_000]);
        $payment = $invoice->payments()->first();

        $response = $this->get("/api/payments/{$payment->id}/receipt")->assertOk()->assertHeader('content-type', 'application/pdf');
        $this->assertStringContainsString($payment->number, $response->headers->get('content-disposition'));
    }

    public function test_agents_list_only_their_own_payments(): void
    {
        $invoice = $this->issuedInvoice(500_000);
        $this->agent();
        $this->postJson("/api/invoices/{$invoice->id}/payments", ['method' => 'especes', 'amount' => 100_000]);
        $this->agent();
        $this->postJson("/api/invoices/{$invoice->id}/payments", ['method' => 'wave', 'amount' => 50_000, 'reference' => 'W1']);

        $this->getJson('/api/payments')->assertJsonCount(1, 'data')->assertJsonPath('summary.total', 50_000);

        Sanctum::actingAs(User::factory()->withRoles(Role::Comptable)->create());
        $this->getJson('/api/payments')->assertJsonCount(2, 'data')->assertJsonPath('summary.total', 150_000);
    }
}
