<?php

namespace App\Providers;

use App\Models\CashMovement;
use App\Models\CashSession;
use App\Models\CatalogItem;
use App\Models\Client;
use App\Models\ClientDocument;
use App\Models\CompanySetting;
use App\Models\DepositSettlement;
use App\Models\Interaction;
use App\Models\Invoice;
use App\Models\Lease;
use App\Models\LeaseInspection;
use App\Models\LeaseInspectionPhoto;
use App\Models\Mandate;
use App\Models\OwnerPayout;
use App\Models\Payment;
use App\Models\Permission;
use App\Models\Property;
use App\Models\PropertyCheck;
use App\Models\PropertyDocument;
use App\Models\Quote;
use App\Models\Role;
use App\Models\SearchCriterion;
use App\Models\Task;
use App\Models\Trade;
use App\Models\User;
use App\Models\Visit;
use App\Models\Worksite;
use App\Models\WorksitePhoto;
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
            'invoice' => Invoice::class,
            'payment' => Payment::class,
            'cash_session' => CashSession::class,
            'cash_movement' => CashMovement::class,
            'role' => Role::class,
            'lease' => Lease::class,
            'owner_payout' => OwnerPayout::class,
            'lease_inspection' => LeaseInspection::class,
            'lease_inspection_photo' => LeaseInspectionPhoto::class,
            'deposit_settlement' => DepositSettlement::class,
            'trade' => Trade::class,
            'catalog_item' => CatalogItem::class,
            'quote' => Quote::class,
            'worksite' => Worksite::class,
            'worksite_photo' => WorksitePhoto::class,
            'permission' => Permission::class,
        ]);

        // RBAC : le dirigeant (super-administrateur) a accès à tout ; les autres passent par leurs
        // permissions, vérifiées dans les policies ou directement (« can:invoices.view »).
        Gate::before(fn (User $user) => $user->isSuperAdmin() ? true : null);
    }
}
