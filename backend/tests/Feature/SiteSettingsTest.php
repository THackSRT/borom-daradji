<?php

namespace Tests\Feature;

use App\Models\CompanySetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SiteSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_site_uses_defaults_until_the_dirigeant_changes_something(): void
    {
        $this->getJson('/api/public/site')
            ->assertOk()
            ->assertJsonPath('data.company.trade_name', 'Borom Daradji')
            ->assertJsonPath('data.content.identity.primary_color', '#0d2f73')
            ->assertJsonPath('data.content.home.hero_highlight', 'ici')
            ->assertJsonCount(8, 'data.content.works.services')
            ->assertJsonMissingPath('data.company.ninea');
    }

    public function test_only_the_dirigeant_edits_the_site(): void
    {
        Sanctum::actingAs(User::factory()->create());

        $this->getJson('/api/settings/site')->assertForbidden();
        $this->putJson('/api/settings/site/home', ['hero_title' => 'Bienvenue'])->assertForbidden();
        $this->post('/api/settings/site/images', [], ['Accept' => 'application/json'])->assertForbidden();
    }

    public function test_only_changed_values_are_stored_and_the_rest_follows_the_defaults(): void
    {
        Sanctum::actingAs(User::factory()->dirigeant()->create());

        $this->putJson('/api/settings/site/home', [
            'hero_title' => 'Trouvez votre maison à Dakar',
            'hero_badge' => "Leader de l'immobilier au Sénégal",
            'show_cta' => false,
        ])
            ->assertOk()
            ->assertJsonPath('data.content.home.hero_title', 'Trouvez votre maison à Dakar')
            ->assertJsonPath('data.content.home.hero_highlight', 'ici')
            ->assertJsonPath('data.customized', ['home']);

        // Tri des clés : MySQL réordonne les clés des colonnes JSON.
        $stored = CompanySetting::current()->site;
        ksort($stored['home']);
        $this->assertSame(
            ['home' => ['hero_title' => 'Trouvez votre maison à Dakar', 'show_cta' => false]],
            $stored,
        );

        $this->getJson('/api/public/site')
            ->assertJsonPath('data.content.home.hero_title', 'Trouvez votre maison à Dakar')
            ->assertJsonPath('data.content.home.show_cta', false)
            ->assertJsonPath('data.content.home.show_why', true);
    }

    public function test_a_list_replaces_the_default_list(): void
    {
        Sanctum::actingAs(User::factory()->dirigeant()->create());

        $this->putJson('/api/settings/site/home', [
            'stats' => [['icon' => 'key', 'value' => '300', 'label' => 'Locations gérées']],
        ])->assertOk();

        $this->getJson('/api/public/site')
            ->assertJsonCount(1, 'data.content.home.stats')
            ->assertJsonPath('data.content.home.stats.0.label', 'Locations gérées');
    }

    public function test_colors_icons_and_links_are_checked(): void
    {
        Sanctum::actingAs(User::factory()->dirigeant()->create());

        $this->putJson('/api/settings/site/identity', ['primary_color' => 'bleu'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('primary_color');

        $this->putJson('/api/settings/site/home', [
            'services' => [['icon' => 'licorne', 'title' => 'Achat']],
        ])->assertJsonValidationErrors('services.0.icon');

        $this->putJson('/api/settings/site/social', ['facebook' => 'javascript:alert(1)'])
            ->assertJsonValidationErrors('facebook');

        $this->putJson('/api/settings/site/inconnue', ['x' => 1])->assertNotFound();
    }

    public function test_unknown_fields_are_ignored(): void
    {
        Sanctum::actingAs(User::factory()->dirigeant()->create());

        $this->putJson('/api/settings/site/identity', ['tagline' => 'Immobilier & Travaux', 'script' => '<script>'])->assertOk();

        $this->assertSame(['identity' => ['tagline' => 'Immobilier & Travaux']], CompanySetting::current()->site);
    }

    public function test_emptied_social_link_is_stored_as_empty_text(): void
    {
        Sanctum::actingAs(User::factory()->dirigeant()->create());

        $this->putJson('/api/settings/site/social', ['facebook' => 'https://facebook.com/borom'])->assertOk();
        $this->putJson('/api/settings/site/social', ['facebook' => ''])
            ->assertOk()
            ->assertJsonPath('data.content.social.facebook', '')
            ->assertJsonPath('data.customized', []);
    }

    public function test_uploaded_image_is_used_then_deleted_when_replaced(): void
    {
        Storage::fake('public');
        Sanctum::actingAs(User::factory()->dirigeant()->create());

        $path = $this->post('/api/settings/site/images', ['image' => UploadedFile::fake()->image('facade.jpg', 2400, 1200)], ['Accept' => 'application/json'])
            ->assertCreated()
            ->json('data.path');

        $this->assertStringStartsWith('site/', $path);
        Storage::disk('public')->assertExists($path);

        $urls = $this->putJson('/api/settings/site/home', ['hero_image' => $path])->assertOk()->json('data.image_urls');
        $this->assertStringEndsWith($path, $urls[$path]);

        $this->getJson('/api/public/site')
            ->assertJsonPath('data.content.home.hero_image', fn (string $url) => str_contains($url, '/storage/site/'));

        $this->putJson('/api/settings/site/home', ['hero_image' => null])->assertOk();
        Storage::disk('public')->assertMissing($path);
    }

    public function test_image_must_have_been_uploaded_or_be_an_https_address(): void
    {
        Storage::fake('public');
        Sanctum::actingAs(User::factory()->dirigeant()->create());

        $this->putJson('/api/settings/site/home', ['hero_image' => '../.env'])->assertJsonValidationErrors('hero_image');
        $this->putJson('/api/settings/site/home', ['hero_image' => 'site/absente.webp'])->assertJsonValidationErrors('hero_image');
        $this->putJson('/api/settings/site/home', ['hero_image' => 'https://exemple.sn/facade.jpg'])->assertOk();
    }

    public function test_reset_restores_the_default_section(): void
    {
        Sanctum::actingAs(User::factory()->dirigeant()->create());

        $this->putJson('/api/settings/site/works', ['commitments' => ['Devis gratuit']])->assertOk();
        $this->deleteJson('/api/settings/site/works')
            ->assertOk()
            ->assertJsonCount(4, 'data.content.works.commitments')
            ->assertJsonPath('data.customized', []);
    }

    public function test_legal_identifiers_are_public_only_when_the_dirigeant_chooses_it(): void
    {
        CompanySetting::current()->update(['ninea' => '005123456', 'rccm' => 'SN-DKR-2020-B-1']);
        Sanctum::actingAs(User::factory()->dirigeant()->create());

        $this->getJson('/api/public/site')->assertJsonMissingPath('data.company.ninea');

        $this->putJson('/api/settings/site/legal', ['show_identifiers' => true])->assertOk();

        $this->getJson('/api/public/site')
            ->assertJsonPath('data.company.ninea', '005123456')
            ->assertJsonPath('data.company.rccm', 'SN-DKR-2020-B-1');
    }

    public function test_dirigeant_removes_the_logo(): void
    {
        Storage::fake('public');
        Sanctum::actingAs(User::factory()->dirigeant()->create());

        $this->post('/api/settings/company/logo', ['logo' => UploadedFile::fake()->image('logo.png')], ['Accept' => 'application/json'])->assertOk();
        $path = CompanySetting::current()->logo_path;

        $this->deleteJson('/api/settings/company/logo')
            ->assertOk()
            ->assertJsonPath('data.logo_url', null);

        Storage::disk('public')->assertMissing($path);
    }
}
