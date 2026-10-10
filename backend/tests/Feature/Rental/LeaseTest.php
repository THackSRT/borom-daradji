<?php

namespace Tests\Feature\Rental;

use App\Enums\Role;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Lease;
use App\Models\Property;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class LeaseTest extends TestCase
{
    use RefreshDatabase;

    private User $agent;

    private Property $property;

    private Client $tenant;

    private Client $owner;

    protected function setUp(): void
    {
        parent::setUp();
        User::factory()->dirigeant()->create();
        $this->agent = User::factory()->withRoles(Role::Agent)->create();
        $this->owner = Client::factory()->create(['name' => 'Mamadou Ndiaye']);
        $this->property = Property::factory()->forRent(450_000)->published()->create(['owner_id' => $this->owner->id, 'agent_id' => $this->agent->id]);
        $this->tenant = Client::factory()->create(['name' => 'Aminata Ba', 'phone' => '+221776543210']);
        Sanctum::actingAs($this->agent);
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return [
            'property_id' => $this->property->id,
            'tenant_id' => $this->tenant->id,
            'start_date' => today()->toDateString(),
            'rent' => 450_000,
            'charges' => 25_000,
            'deposit' => 900_000,
            'advance_months' => 1,
            'due_day' => 5,
            ...$overrides,
        ];
    }

    public function test_a_lease_gets_a_reference_takes_the_owner_and_rents_out_the_property(): void
    {
        $this->postJson('/api/leases', $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.reference', sprintf('BAIL-%d-0001', now()->year))
            ->assertJsonPath('data.owner.name', 'Mamadou Ndiaye')
            ->assertJsonPath('data.billing_start', today()->startOfMonth()->toDateString())
            // Un mois payé d'avance : son appel de loyer est émis dès la signature.
            ->assertJsonCount(1, 'data.rent_calls');

        $this->assertSame('loue', $this->property->fresh()->status->value);
    }

    public function test_a_property_cannot_have_two_leases_in_progress(): void
    {
        $this->postJson('/api/leases', $this->payload())->assertCreated();

        $this->postJson('/api/leases', $this->payload(['tenant_id' => Client::factory()->create()->id]))
            ->assertJsonValidationErrors('property_id');
    }

    public function test_only_properties_for_rent_can_be_leased(): void
    {
        $forSale = Property::factory()->published()->create();

        $this->postJson('/api/leases', $this->payload(['property_id' => $forSale->id]))->assertJsonValidationErrors('property_id');
    }

    public function test_a_managed_lease_needs_an_owner(): void
    {
        $this->property->update(['owner_id' => null]);

        $this->postJson('/api/leases', $this->payload(['managed' => true, 'commission_rate' => 10]))->assertJsonValidationErrors('owner_id');
    }

    public function test_entry_invoice_is_prepared_as_a_draft_with_deposit_and_fees(): void
    {
        $id = $this->postJson('/api/leases', $this->payload(['entry_invoice' => true, 'agency_fee' => 450_000]))
            ->assertCreated()
            ->assertJsonPath('data.entry_invoice.status.value', 'brouillon')
            ->json('data.entry_invoice.id');

        $invoice = Invoice::with('lines')->findOrFail($id);
        $this->assertSame(['Caution', 'Frais d\'agence'], $invoice->lines->map(fn ($l) => explode(' —', $l->description)[0])->all());
        // 900 000 + 450 000 × 1,18 (TVA sur les frais d'agence).
        $this->assertSame(900_000 + 531_000, $invoice->total);
    }

    public function test_months_paid_in_advance_are_called_at_signature(): void
    {
        Carbon::setTestNow('2026-10-10');
        $this->postJson('/api/leases', $this->payload(['start_date' => '2026-11-01', 'advance_months' => 2]))
            ->assertCreated()
            ->assertJsonCount(2, 'data.rent_calls')
            ->assertJsonPath('data.rent_calls.0.period', '2026-12-01')
            ->assertJsonPath('data.rent_calls.1.period', '2026-11-01');
    }

    public function test_a_lease_entered_late_calls_the_months_already_due(): void
    {
        Carbon::setTestNow('2026-10-10');
        $this->postJson('/api/leases', $this->payload(['start_date' => '2026-07-01', 'advance_months' => 1]))
            ->assertCreated()
            ->assertJsonCount(4, 'data.rent_calls')
            ->assertJsonPath('data.rent_calls.0.period', '2026-10-01')
            ->assertJsonPath('data.rent_calls.3.period', '2026-07-01');
    }

    public function test_termination_stops_future_rent_calls(): void
    {
        Carbon::setTestNow('2026-10-10');
        $id = $this->postJson('/api/leases', $this->payload(['start_date' => '2026-09-01', 'advance_months' => 0]))->json('data.id');

        $this->postJson("/api/leases/{$id}/terminate", ['terminated_on' => '2026-10-31', 'reason' => 'Départ du locataire'])
            ->assertOk()
            ->assertJsonPath('data.status.value', 'resilie');

        Carbon::setTestNow('2026-12-02');
        $this->artisan('borom:generate-rent-calls')->assertSuccessful();
        $this->assertSame(2, Lease::find($id)->rentCalls()->count());

        $this->putJson("/api/leases/{$id}", ['rent' => 500_000])->assertJsonValidationErrors('lease');
    }

    public function test_only_people_allowed_to_manage_leases_create_them(): void
    {
        Sanctum::actingAs(User::factory()->withRoles(Role::Commercial)->create());

        $this->getJson('/api/leases')->assertOk();
        $this->postJson('/api/leases', $this->payload())->assertForbidden();

        Sanctum::actingAs(User::factory()->withRoles(Role::ResponsableTravaux)->create());
        $this->getJson('/api/leases')->assertForbidden();
    }
}
