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

class RentCallTest extends TestCase
{
    use RefreshDatabase;

    private User $agent;

    private Lease $lease;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-10-02');
        User::factory()->dirigeant()->create();
        $this->agent = User::factory()->withRoles(Role::Agent)->create();
        $owner = Client::factory()->create();
        $property = Property::factory()->forRent()->published()->create(['owner_id' => $owner->id, 'title' => 'Appartement F3 Mermoz']);
        $this->lease = app(RentService::class)->createLease([
            'property_id' => $property->id,
            'tenant_id' => Client::factory()->create(['name' => 'Aminata Ba', 'phone' => '+221776543210'])->id,
            'start_date' => '2026-10-01',
            'rent' => 450_000,
            'charges' => 25_000,
            'due_day' => 5,
            'managed' => true,
            'commission_rate' => 10,
        ], $this->agent);
        Sanctum::actingAs($this->agent);
    }

    public function test_the_daily_job_issues_one_invoice_per_month_without_duplicates(): void
    {
        $this->artisan('borom:generate-rent-calls')->assertSuccessful();
        $this->artisan('borom:generate-rent-calls')->assertSuccessful();

        $call = $this->lease->rentCalls()->with('invoice.lines')->sole();
        $this->assertSame('2026-10-01', $call->period->toDateString());
        $this->assertSame('emise', $call->invoice->status->value);
        $this->assertSame('2026-10-05', $call->invoice->due_date->toDateString());
        $this->assertSame(475_000, $call->invoice->total);
        $this->assertSame('Loyer Octobre 2026 — Appartement F3 Mermoz', $call->invoice->lines[0]->description);

        Carbon::setTestNow('2026-11-01');
        $this->artisan('borom:generate-rent-calls')->assertSuccessful();
        $this->assertSame(2, $this->lease->rentCalls()->count());
    }

    public function test_arrears_and_whatsapp_reminder_list_the_unpaid_months(): void
    {
        app(RentService::class)->generateCalls($this->lease);
        Carbon::setTestNow('2026-11-10');
        app(RentService::class)->generateCalls($this->lease);

        $this->getJson("/api/leases/{$this->lease->id}")
            ->assertJsonPath('data.arrears', 950_000)
            ->assertJsonPath('data.months_overdue', 2)
            ->assertJsonPath('data.whatsapp_reminder_url', fn (string $url) => str_contains(urldecode($url), 'octobre 2026 et novembre 2026'));

        $this->getJson('/api/leases?arrears=1')->assertJsonCount(1, 'data');
    }

    public function test_quittance_is_only_delivered_once_the_month_is_fully_paid(): void
    {
        app(RentService::class)->generateCalls($this->lease);
        $call = $this->lease->rentCalls()->with('invoice')->sole();
        $url = "/api/leases/{$this->lease->id}/rent-calls/{$call->id}/quittance";

        Billing::recordPayment($call->invoice, ['method' => 'especes', 'amount' => 200_000], $this->agent);
        $this->getJson($url)->assertJsonValidationErrors('rent_call');

        Billing::recordPayment($call->invoice->fresh(), ['method' => 'wave', 'amount' => 275_000, 'reference' => 'W-OCT'], $this->agent);
        $this->get($url)->assertOk()->assertHeader('content-type', 'application/pdf');
        $this->assertDatabaseHas('activity_logs', ['action' => 'downloaded', 'subject_type' => 'lease', 'subject_id' => $this->lease->id]);
    }

    public function test_rent_change_applies_to_the_next_calls_only(): void
    {
        app(RentService::class)->generateCalls($this->lease);
        $this->putJson("/api/leases/{$this->lease->id}", ['rent' => 500_000])->assertOk();

        Carbon::setTestNow('2026-11-01');
        $this->postJson("/api/leases/{$this->lease->id}/rent-calls")->assertOk()
            ->assertJsonPath('data.rent_calls.0.invoice.total', 525_000)
            ->assertJsonPath('data.rent_calls.1.invoice.total', 475_000);
    }
}
