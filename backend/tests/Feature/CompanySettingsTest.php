<?php

namespace Tests\Feature;

use App\Models\CompanySetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CompanySettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_defaults_use_senegal_vat_and_cfa_franc(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/settings/company')
            ->assertOk()
            ->assertJsonPath('data.trade_name', 'Borom Daradji')
            ->assertJsonPath('data.vat_rate', 18)
            ->assertJsonPath('data.currency', 'XOF');
    }

    public function test_only_the_dirigeant_updates_settings(): void
    {
        Sanctum::actingAs(User::factory()->create());
        $this->putJson('/api/settings/company', ['ninea' => '123'])->assertForbidden();

        Sanctum::actingAs(User::factory()->dirigeant()->create());
        $this->putJson('/api/settings/company', [
            'ninea' => '005123456 2G3',
            'rccm' => 'SN-DKR-2020-B-12345',
            'whatsapp' => '77 123 45 67',
        ])
            ->assertOk()
            ->assertJsonPath('data.ninea', '005123456 2G3')
            ->assertJsonPath('data.whatsapp', '+221771234567');

        $this->assertSame(1, CompanySetting::count());
    }

    public function test_public_endpoint_exposes_contact_details_only(): void
    {
        CompanySetting::current()->update([
            'phone' => '+221338678900',
            'ninea' => '005123456',
            'bank_account' => 'SN012 01001 000000000000 12',
        ]);

        $this->getJson('/api/public/company')
            ->assertOk()
            ->assertJsonPath('data.phone', '+221338678900')
            ->assertJsonMissingPath('data.ninea')
            ->assertJsonMissingPath('data.bank_account');
    }

    public function test_dirigeant_uploads_a_logo_that_replaces_the_previous_one(): void
    {
        Storage::fake('public');
        Sanctum::actingAs(User::factory()->dirigeant()->create());

        $this->post('/api/settings/company/logo', ['logo' => UploadedFile::fake()->image('ancien.png')], ['Accept' => 'application/json'])->assertOk();
        $first = CompanySetting::current()->logo_path;

        $this->post('/api/settings/company/logo', ['logo' => UploadedFile::fake()->image('logo.png')], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('data.logo_url', fn (string $url) => str_contains($url, 'company/'));

        Storage::disk('public')->assertMissing($first);
        Storage::disk('public')->assertExists(CompanySetting::current()->logo_path);
    }
}
