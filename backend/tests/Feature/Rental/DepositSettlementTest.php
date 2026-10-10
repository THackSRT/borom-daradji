<?php

namespace Tests\Feature\Rental;

use App\Enums\Role;
use App\Models\CashSession;
use App\Models\Client;
use App\Models\DepositSettlement;
use App\Models\Invoice;
use App\Models\Lease;
use App\Models\Property;
use App\Models\User;
use App\Services\Billing;
use App\Services\RentService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DepositSettlementTest extends TestCase
{
    use RefreshDatabase;

    private User $agent;

    private User $accountant;

    private Client $owner;

    private Lease $lease;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-10-10');
        User::factory()->dirigeant()->create();
        $this->agent = User::factory()->withRoles(Role::Agent)->create();
        $this->accountant = User::factory()->withRoles(Role::Comptable)->create();
        $this->owner = Client::factory()->create(['name' => 'Mamadou Ndiaye']);
    }

    /**
     * Bail géré commencé le 1er septembre, caution de 900 000 sur la facture d'entrée (encaissée en
     * espèces par le comptable), septembre payé, octobre impayé, résilié fin octobre.
     *
     * @param  array<string, mixed>  $overrides
     */
    private function endedLease(array $overrides = [], bool $payEntry = true): Lease
    {
        $property = Property::factory()->forRent(450_000)->published()->create(['owner_id' => $this->owner->id, 'agent_id' => $this->agent->id]);
        Sanctum::actingAs($this->agent);
        $id = $this->postJson('/api/leases', [
            'property_id' => $property->id,
            'tenant_id' => Client::factory()->create(['name' => 'Aminata Ba'])->id,
            'start_date' => '2026-09-01',
            'rent' => 450_000,
            'deposit' => 900_000,
            'due_day' => 5,
            'managed' => true,
            'commission_rate' => 10,
            'entry_invoice' => true,
            ...$overrides,
        ])->assertCreated()->json('data.id');
        $lease = Lease::with('rentCalls.invoice', 'entryInvoice')->findOrFail($id);

        if ($payEntry && $lease->entryInvoice) {
            $entry = Billing::issue($lease->entryInvoice, $this->accountant);
            Billing::recordPayment($entry, ['method' => 'especes', 'amount' => $entry->total], $this->accountant);
        }
        $september = $lease->rentCalls->firstWhere(fn ($c) => $c->period->month === 9);
        Billing::recordPayment($september->invoice, ['method' => 'wave', 'amount' => 450_000, 'reference' => "WV-SEPT-{$id}"], $this->agent);

        $this->postJson("/api/leases/{$id}/terminate", ['terminated_on' => '2026-10-31', 'reason' => 'Départ du locataire'])->assertOk();
        Sanctum::actingAs($this->accountant);

        return $lease->fresh();
    }

    public function test_the_deposit_is_settled_only_after_termination_and_with_the_right_permission(): void
    {
        $property = Property::factory()->forRent(450_000)->published()->create(['agent_id' => $this->agent->id]);
        Sanctum::actingAs($this->agent);
        $id = $this->postJson('/api/leases', [
            'property_id' => $property->id, 'tenant_id' => Client::factory()->create()->id,
            'start_date' => '2026-10-01', 'rent' => 450_000, 'deposit' => 900_000, 'due_day' => 5,
        ])->json('data.id');

        // L'agent gère les baux mais ne rend pas d'argent.
        $this->postJson("/api/leases/{$id}/deposit", [])->assertForbidden();

        Sanctum::actingAs($this->accountant);
        $this->getJson("/api/leases/{$id}/deposit")->assertOk()->assertJsonPath('data.can_settle', false);
        $this->postJson("/api/leases/{$id}/deposit", [])->assertJsonValidationErrors('lease');
    }

    public function test_unpaid_rent_and_repairs_are_retained_and_the_rest_is_refunded(): void
    {
        $lease = $this->endedLease();

        $this->getJson("/api/leases/{$lease->id}/deposit")
            ->assertOk()
            ->assertJsonPath('data.deposit_collected', 900_000)
            ->assertJsonPath('data.arrears_total', 450_000)
            ->assertJsonPath('data.unpaid_calls.0.label', 'Octobre 2026')
            ->assertJsonPath('data.can_settle', true);

        $this->postJson("/api/leases/{$lease->id}/deposit", [
            'deductions' => [['label' => 'Peinture de la chambre 1', 'amount' => 150_000]],
            'refund_method' => 'wave',
            'refund_reference' => 'WV-REMB-1',
        ])
            ->assertCreated()
            ->assertJsonPath('data.number', 'CAU-2026-0001')
            ->assertJsonPath('data.deposit_held', 900_000)
            ->assertJsonPath('data.arrears_retained', 450_000)
            ->assertJsonPath('data.deductions_total', 150_000)
            ->assertJsonPath('data.refund', 300_000)
            ->assertJsonPath('data.balance_due', 0);

        // Octobre est soldé par la caution : quittance possible, et le loyer revient au propriétaire.
        $october = $lease->rentCalls()->with('invoice.payments')->get()->firstWhere(fn ($c) => $c->period->month === 10);
        $this->assertTrue($october->isPaid());
        $this->assertSame('caution', $october->invoice->payments->first()->method->value);
        $statement = app(RentService::class)->statement($this->owner, CarbonImmutable::parse('2026-10-01'));
        $this->assertSame(900_000, $statement['collected']);

        $this->getJson("/api/leases/{$lease->id}")->assertJsonPath('data.deposit_settlement.refund', 300_000);
        $this->postJson("/api/leases/{$lease->id}/deposit", [])->assertJsonValidationErrors('lease');
    }

    public function test_repairs_beyond_the_deposit_are_invoiced_to_the_tenant(): void
    {
        $lease = $this->endedLease();

        $response = $this->postJson("/api/leases/{$lease->id}/deposit", [
            'deductions' => [['label' => 'Carrelage cassé', 'amount' => 600_000]],
        ])
            ->assertCreated()
            ->assertJsonPath('data.refund', 0)
            ->assertJsonPath('data.balance_due', 150_000)
            ->assertJsonPath('data.balance_invoice.status.value', 'brouillon');

        $invoice = Invoice::findOrFail($response->json('data.balance_invoice.id'));
        $this->assertSame(150_000, $invoice->total);
        $this->assertSame($lease->tenant_id, $invoice->client_id);
    }

    public function test_a_cash_refund_leaves_the_till_of_the_person_who_pays(): void
    {
        $lease = $this->endedLease();
        $session = CashSession::query()->where('user_id', $this->accountant->id)->firstOrFail();
        $this->assertSame(900_000, $session->expected());

        $this->postJson("/api/leases/{$lease->id}/deposit", ['refund_method' => 'especes'])->assertCreated()->assertJsonPath('data.refund', 450_000);

        $this->assertSame(450_000, $session->fresh()->expected());
        $this->assertSame('restitution_caution', $session->movements()->first()->type->value);
    }

    public function test_a_cash_refund_cannot_exceed_the_cash_in_the_till(): void
    {
        $lease = $this->endedLease();
        Sanctum::actingAs(User::factory()->withRoles(Role::Comptable)->create());

        $this->postJson("/api/leases/{$lease->id}/deposit", ['refund_method' => 'especes'])->assertJsonValidationErrors('refund_method');
        $this->assertSame(0, DepositSettlement::count());
    }

    public function test_a_refund_needs_a_method_and_a_reference_outside_cash(): void
    {
        $lease = $this->endedLease();

        $this->postJson("/api/leases/{$lease->id}/deposit", [])->assertJsonValidationErrors('refund_method');
        $this->postJson("/api/leases/{$lease->id}/deposit", ['refund_method' => 'orange_money'])->assertJsonValidationErrors('refund_reference');
        $this->postJson("/api/leases/{$lease->id}/deposit", ['refund_method' => 'caution'])->assertJsonValidationErrors('refund_method');
    }

    public function test_arrears_can_be_left_out_of_the_deposit(): void
    {
        $lease = $this->endedLease();

        $this->postJson("/api/leases/{$lease->id}/deposit", ['retain_arrears' => false, 'refund_method' => 'cheque', 'refund_reference' => 'CHQ 0012'])
            ->assertCreated()
            ->assertJsonPath('data.arrears_retained', 0)
            ->assertJsonPath('data.refund', 900_000);

        $this->assertSame(450_000, $lease->fresh()->arrears());
    }

    public function test_the_deposit_held_follows_the_entry_invoice(): void
    {
        // Facture d'entrée non émise : rien d'encaissé.
        $lease = $this->endedLease(payEntry: false);
        $this->getJson("/api/leases/{$lease->id}/deposit")->assertJsonPath('data.deposit_collected', 0);

        // Bail saisi sans facture d'entrée : la caution prévue est réputée reçue, et reste modifiable.
        $other = $this->endedLease(['entry_invoice' => false]);
        $this->getJson("/api/leases/{$other->id}/deposit")->assertJsonPath('data.deposit_collected', 900_000);
        // Caution réellement reçue plus faible : elle ne couvre qu'une partie d'octobre.
        $this->postJson("/api/leases/{$other->id}/deposit", ['deposit_held' => 400_000])
            ->assertCreated()
            ->assertJsonPath('data.deposit_held', 400_000)
            ->assertJsonPath('data.arrears_retained', 400_000)
            ->assertJsonPath('data.refund', 0);
        $this->assertSame(50_000, $other->fresh()->arrears());
    }

    public function test_the_settlement_pdf_is_generated(): void
    {
        $lease = $this->endedLease();
        $this->postJson("/api/leases/{$lease->id}/deposit", ['refund_method' => 'wave', 'refund_reference' => 'WV-9'])->assertCreated();

        $this->get("/api/leases/{$lease->id}/deposit/pdf")->assertOk()->assertHeader('content-type', 'application/pdf');
    }

    public function test_deposit_retention_is_not_a_manual_payment_method(): void
    {
        $lease = $this->endedLease();
        $october = $lease->rentCalls()->get()->firstWhere(fn ($c) => $c->period->month === 10);

        $this->postJson("/api/invoices/{$october->invoice_id}/payments", ['method' => 'caution', 'amount' => 1000])
            ->assertJsonValidationErrors('method');
    }
}
