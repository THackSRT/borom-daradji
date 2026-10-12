<?php

namespace Tests\Feature\Rental;

use App\Enums\Role;
use App\Models\Client;
use App\Models\Lease;
use App\Models\Property;
use App\Models\User;
use App\Services\Billing;
use App\Services\RentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OwnerPayoutTest extends TestCase
{
    use RefreshDatabase;

    private Client $owner;

    private Lease $lease;

    private User $comptable;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-10-02');
        User::factory()->dirigeant()->create();
        $this->comptable = User::factory()->withRoles(Role::Comptable)->create();
        $this->owner = Client::factory()->create(['name' => 'Mamadou Ndiaye']);
        $property = Property::factory()->forRent()->published()->create(['owner_id' => $this->owner->id]);
        $this->lease = app(RentService::class)->createLease([
            'property_id' => $property->id,
            'tenant_id' => Client::factory()->create()->id,
            'start_date' => '2026-10-01',
            'rent' => 400_000,
            'due_day' => 5,
            'managed' => true,
            'commission_rate' => 10,
        ], $this->comptable);
        app(RentService::class)->generateCalls($this->lease);
        $invoice = $this->lease->rentCalls()->sole()->invoice;
        Billing::recordPayment($invoice, ['method' => 'wave', 'amount' => 400_000, 'reference' => 'W-1'], $this->comptable);
        Sanctum::actingAs($this->comptable);
    }

    public function test_statement_deducts_the_agency_commission_and_its_vat(): void
    {
        $this->getJson("/api/owners/{$this->owner->id}/statement?period=2026-10")
            ->assertOk()
            ->assertJsonPath('data.collected', 400_000)
            ->assertJsonPath('data.commission', 40_000)
            ->assertJsonPath('data.commission_vat', 7_200)
            ->assertJsonPath('data.net_before_expenses', 352_800)
            ->assertJsonCount(1, 'data.lines');

        $this->getJson('/api/owner-payouts/owners?period=2026-10')
            ->assertJsonPath('data.0.name', 'Mamadou Ndiaye')
            ->assertJsonPath('data.0.pending_net', 352_800);
    }

    public function test_a_payout_freezes_the_statement_and_rents_are_not_paid_out_twice(): void
    {
        $this->postJson("/api/owners/{$this->owner->id}/payouts", [
            'period' => '2026-10', 'method' => 'virement', 'reference' => 'VIR-889', 'paid_on' => '2026-10-02',
            'expenses' => [['label' => 'Réparation fuite salle de bain', 'amount' => 30_000]],
        ])->assertCreated()
            ->assertJsonPath('data.number', 'REV-2026-0001')
            ->assertJsonPath('data.net', 322_800);

        $this->getJson("/api/owners/{$this->owner->id}/statement?period=2026-10")->assertJsonPath('data.collected', 0);
        $this->postJson("/api/owners/{$this->owner->id}/payouts", ['period' => '2026-10', 'method' => 'virement', 'paid_on' => '2026-10-02'])
            ->assertJsonValidationErrors('period');

        $id = $this->getJson('/api/owner-payouts')->json('data.0.id');
        $this->get("/api/owner-payouts/{$id}/pdf")->assertOk()->assertHeader('content-type', 'application/pdf');
    }

    public function test_cancelling_a_payout_puts_the_rents_back_to_pay_out(): void
    {
        $id = $this->postJson("/api/owners/{$this->owner->id}/payouts", ['period' => '2026-10', 'method' => 'especes', 'paid_on' => '2026-10-02'])->json('data.id');

        $this->postJson("/api/owner-payouts/{$id}/cancel", ['reason' => 'Mauvais propriétaire'])->assertOk();

        $this->getJson("/api/owners/{$this->owner->id}/statement?period=2026-10")->assertJsonPath('data.collected', 400_000);
    }

    public function test_expenses_cannot_exceed_what_the_owner_is_owed(): void
    {
        $this->postJson("/api/owners/{$this->owner->id}/payouts", [
            'period' => '2026-10', 'method' => 'especes', 'paid_on' => '2026-10-02',
            'expenses' => [['label' => 'Gros travaux', 'amount' => 500_000]],
        ])->assertJsonValidationErrors('expenses');
    }

    public function test_unmanaged_leases_do_not_appear_on_owner_statements(): void
    {
        $this->lease->update(['managed' => false]);

        $this->getJson("/api/owners/{$this->owner->id}/statement?period=2026-10")->assertJsonPath('data.collected', 0);
    }

    public function test_payouts_are_reserved_to_allowed_people(): void
    {
        Sanctum::actingAs(User::factory()->withRoles(Role::Agent)->create());

        $this->getJson('/api/owner-payouts')->assertForbidden();
        $this->postJson("/api/owners/{$this->owner->id}/payouts", [])->assertForbidden();
    }
}
