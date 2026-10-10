<?php

namespace App\Providers;

use App\Models\Client;
use App\Models\ClientDocument;
use App\Models\CompanySetting;
use App\Models\Interaction;
use App\Models\Mandate;
use App\Models\Property;
use App\Models\PropertyCheck;
use App\Models\PropertyDocument;
use App\Models\SearchCriterion;
use App\Models\Task;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Alias stables en base (journal d'activité, pièces jointes…) plutôt que des noms de classes PHP.
        // Ne jamais renommer un alias existant : il est stocké dans le journal.
        Relation::enforceMorphMap([
            'user' => User::class,
            'company_settings' => CompanySetting::class,
            'client' => Client::class,
            'client_document' => ClientDocument::class,
            'search_criterion' => SearchCriterion::class,
            'property' => Property::class,
            'property_document' => PropertyDocument::class,
            'property_check' => PropertyCheck::class,
            'mandate' => Mandate::class,
            'interaction' => Interaction::class,
            'visit' => Visit::class,
            'task' => Task::class,
        ]);

        // Le dirigeant a accès à tout ; les autres rôles passent par les policies.
        Gate::before(fn (User $user) => $user->isDirigeant() ? true : null);

        // Comptes, paramètres de l'entreprise et journal d'activité : dirigeant uniquement.
        Gate::define('administrate', fn (User $user) => $user->isDirigeant());
    }
}
