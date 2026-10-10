<?php

namespace App\Http\Requests;

use App\Rules\SiteImage;
use App\Support\SiteContent;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Une section du site vitrine (route settings/site/{section}). Les champs absents gardent leur valeur.
 */
class UpdateSiteSectionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('administrate');
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return match ($this->route('section')) {
            'identity' => [
                'tagline' => ['sometimes', 'nullable', 'string', 'max:80'],
                'show_name' => ['sometimes', 'boolean'],
                'primary_color' => ['sometimes', 'required', 'regex:/^#[0-9a-fA-F]{6}$/'],
                'accent_color' => ['sometimes', 'required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            ],
            'seo' => [
                'title' => ['sometimes', 'required', 'string', 'max:70'],
                'description' => ['sometimes', 'required', 'string', 'max:200'],
            ],
            'contact' => [
                'title' => ['sometimes', 'required', 'string', 'max:80'],
                'intro' => ['sometimes', 'nullable', 'string', 'max:500'],
                'form_title' => ['sometimes', 'required', 'string', 'max:80'],
                'form_text' => ['sometimes', 'nullable', 'string', 'max:200'],
                'hours' => ['sometimes', 'array', 'max:7'],
                'hours.*.days' => ['required', 'string', 'max:40'],
                'hours.*.hours' => ['required', 'string', 'max:40'],
                'subjects' => ['sometimes', 'array', 'min:1', 'max:12'],
                'subjects.*' => ['required', 'string', 'max:80', 'distinct'],
            ],
            'social' => collect(array_keys(SiteContent::defaults()['social']))
                ->mapWithKeys(fn (string $network) => [$network => ['sometimes', 'nullable', 'url:https,http', 'max:255']])
                ->all(),
            'footer' => [
                'about' => ['sometimes', 'nullable', 'string', 'max:400'],
                'copyright' => ['sometimes', 'nullable', 'string', 'max:150'],
            ],
            'legal' => [
                'show_identifiers' => ['sometimes', 'boolean'],
                'notice' => ['sometimes', 'nullable', 'string', 'max:10000'],
                'privacy' => ['sometimes', 'nullable', 'string', 'max:10000'],
            ],
            'home' => [
                ...$this->texts([
                    'hero_badge' => 80, 'hero_title' => 120, 'hero_highlight' => 40, 'hero_subtitle' => 400,
                    'featured_kicker' => 60, 'featured_title' => 120,
                    'services_kicker' => 60, 'services_title' => 120, 'services_subtitle' => 400,
                    'why_kicker' => 60, 'why_title' => 120, 'why_text' => 600,
                    'cta_property_title' => 120, 'cta_property_text' => 400, 'cta_property_button' => 40,
                    'cta_works_title' => 120, 'cta_works_text' => 400, 'cta_works_button' => 40,
                ]),
                'hero_image' => ['sometimes', 'nullable', new SiteImage],
                ...$this->toggles(['show_featured', 'show_services', 'show_why', 'show_cta']),
                ...$this->services('services', 8, 6),
                'why_points' => ['sometimes', 'array', 'max:10'],
                'why_points.*' => ['required', 'string', 'max:80'],
                'stats' => ['sometimes', 'array', 'max:6'],
                'stats.*.icon' => ['required', Rule::in(SiteContent::ICONS)],
                'stats.*.value' => ['required', 'string', 'max:20'],
                'stats.*.label' => ['required', 'string', 'max:60'],
            ],
            'works' => [
                ...$this->texts([
                    'kicker' => 60, 'hero_title' => 160, 'hero_subtitle' => 400,
                    'services_title' => 120, 'services_subtitle' => 400,
                    'projects_title' => 120, 'quote_title' => 120, 'quote_text' => 600,
                ]),
                ...$this->toggles(['show_projects']),
                ...$this->services('services', 16, 8),
                'projects' => ['sometimes', 'array', 'max:12'],
                'projects.*.title' => ['required', 'string', 'max:120'],
                'projects.*.location' => ['nullable', 'string', 'max:80'],
                'projects.*.duration' => ['nullable', 'string', 'max:40'],
                'projects.*.description' => ['nullable', 'string', 'max:500'],
                'projects.*.services' => ['nullable', 'array', 'max:8'],
                'projects.*.services.*' => ['required', 'string', 'max:40'],
                'projects.*.before_image' => ['nullable', new SiteImage],
                'projects.*.after_image' => ['required', new SiteImage],
                'commitments' => ['sometimes', 'array', 'max:8'],
                'commitments.*' => ['required', 'string', 'max:120'],
            ],
            default => [],
        };
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'primary_color' => 'couleur principale',
            'accent_color' => "couleur d'accent",
            'services.*.title' => 'titre du service',
            'services.*.icon' => 'icône',
            'stats.*.icon' => 'icône',
            'stats.*.value' => 'chiffre',
            'stats.*.label' => 'libellé',
            'projects.*.title' => 'titre de la réalisation',
            'projects.*.after_image' => 'photo « après »',
            'hours.*.days' => 'jours',
            'hours.*.hours' => 'horaires',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'primary_color.regex' => 'Couleur au format #RRGGBB.',
            'accent_color.regex' => 'Couleur au format #RRGGBB.',
        ];
    }

    /**
     * @param  array<string, int>  $fields  champ => longueur maximale
     * @return array<string, mixed>
     */
    private function texts(array $fields): array
    {
        return collect($fields)
            ->mapWithKeys(fn (int $max, string $field) => [$field => ['sometimes', 'nullable', 'string', "max:{$max}"]])
            ->all();
    }

    /**
     * @param  list<string>  $fields
     * @return array<string, mixed>
     */
    private function toggles(array $fields): array
    {
        return collect($fields)->mapWithKeys(fn (string $field) => [$field => ['sometimes', 'boolean']])->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function services(string $key, int $max, int $maxFeatures): array
    {
        return [
            $key => ['sometimes', 'array', "max:{$max}"],
            "{$key}.*.icon" => ['required', Rule::in(SiteContent::ICONS)],
            "{$key}.*.title" => ['required', 'string', 'max:60'],
            "{$key}.*.description" => ['nullable', 'string', 'max:300'],
            "{$key}.*.features" => ['nullable', 'array', "max:{$maxFeatures}"],
            "{$key}.*.features.*" => ['required', 'string', 'max:40'],
        ];
    }
}
