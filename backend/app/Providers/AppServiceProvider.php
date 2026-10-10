<?php

namespace App\Providers;

use App\Models\CompanySetting;
use App\Models\User;
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
        Relation::enforceMorphMap([
            'user' => User::class,
            'company_settings' => CompanySetting::class,
        ]);

        // Comptes, paramètres de l'entreprise et journal d'activité : dirigeant uniquement.
        Gate::define('administrate', fn (User $user) => $user->isDirigeant());
    }
}
