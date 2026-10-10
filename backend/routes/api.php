<?php

use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CashSessionController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\ClientDocumentController;
use App\Http\Controllers\Api\CompanySettingsController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\InteractionController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\LeaseController;
use App\Http\Controllers\Api\MandateController;
use App\Http\Controllers\Api\MetaController;
use App\Http\Controllers\Api\OwnerPayoutController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\PropertyCheckController;
use App\Http\Controllers\Api\PropertyController;
use App\Http\Controllers\Api\PropertyDocumentController;
use App\Http\Controllers\Api\PropertyPhotoController;
use App\Http\Controllers\Api\PropertyStatusController;
use App\Http\Controllers\Api\Public\LeadController;
use App\Http\Controllers\Api\Public\PublicPropertyController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\SearchCriterionController;
use App\Http\Controllers\Api\SiteSettingsController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\VisitController;
use App\Support\SiteContent;
use Illuminate\Support\Facades\Route;

// Public : site vitrine et connexion.
Route::prefix('public')->group(function () {
    Route::get('company', [CompanySettingsController::class, 'showPublic']);
    Route::get('site', [SiteSettingsController::class, 'showPublic']);
    Route::get('properties', [PublicPropertyController::class, 'index']);
    Route::get('properties/{slug}', [PublicPropertyController::class, 'show']);
    Route::get('places', [PublicPropertyController::class, 'places']);
    Route::post('leads', [LeadController::class, 'store'])->middleware('throttle:5,1');
});
Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:20,1');

Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::get('auth/me', [AuthController::class, 'me']);
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::put('auth/password', [AuthController::class, 'updatePassword']);

    Route::get('meta', MetaController::class);
    Route::get('dashboard', DashboardController::class);
    Route::get('settings/company', [CompanySettingsController::class, 'show']);

    // Biens (droits détaillés dans PropertyPolicy).
    Route::apiResource('properties', PropertyController::class);
    Route::scopeBindings()->prefix('properties/{property}')->group(function () {
        Route::post('status', [PropertyStatusController::class, 'store']);
        Route::get('checks', [PropertyCheckController::class, 'index']);
        Route::put('checks/{check}', [PropertyCheckController::class, 'update']);
        Route::post('photos', [PropertyPhotoController::class, 'store']);
        Route::put('photos/order', [PropertyPhotoController::class, 'reorder']);
        Route::put('photos/{photo}/cover', [PropertyPhotoController::class, 'setCover']);
        Route::delete('photos/{photo}', [PropertyPhotoController::class, 'destroy']);
        Route::get('documents', [PropertyDocumentController::class, 'index']);
        Route::post('documents', [PropertyDocumentController::class, 'store']);
        Route::get('documents/{document}', [PropertyDocumentController::class, 'download']);
        Route::delete('documents/{document}', [PropertyDocumentController::class, 'destroy']);
        Route::get('mandates', [MandateController::class, 'index']);
        Route::post('mandates', [MandateController::class, 'store']);
        Route::put('mandates/{mandate}', [MandateController::class, 'update']);
    });

    // CRM (droits détaillés dans ClientPolicy).
    Route::apiResource('clients', ClientController::class);
    Route::scopeBindings()->prefix('clients/{client}')->group(function () {
        Route::get('documents', [ClientDocumentController::class, 'index']);
        Route::post('documents', [ClientDocumentController::class, 'store']);
        Route::get('documents/{document}', [ClientDocumentController::class, 'download']);
        Route::delete('documents/{document}', [ClientDocumentController::class, 'destroy']);
        Route::post('search-criteria', [SearchCriterionController::class, 'store']);
        Route::put('search-criteria/{searchCriterion}', [SearchCriterionController::class, 'update']);
        Route::delete('search-criteria/{searchCriterion}', [SearchCriterionController::class, 'destroy']);
        Route::get('matches', [SearchCriterionController::class, 'matches']);
        Route::get('interactions', [InteractionController::class, 'index']);
        Route::post('interactions', [InteractionController::class, 'store']);
    });

    Route::apiResource('visits', VisitController::class)->only(['index', 'store', 'update']);
    Route::apiResource('tasks', TaskController::class)->except(['show']);

    // Facturation et encaissements (droits dans InvoicePolicy).
    Route::apiResource('invoices', InvoiceController::class);
    Route::post('invoices/{invoice}/issue', [InvoiceController::class, 'issue']);
    Route::post('invoices/{invoice}/credit-notes', [InvoiceController::class, 'creditNote']);
    Route::get('invoices/{invoice}/pdf', [InvoiceController::class, 'pdf']);
    Route::post('invoices/{invoice}/payments', [PaymentController::class, 'store']);
    Route::get('payments', [PaymentController::class, 'index']);
    Route::post('payments/{payment}/cancel', [PaymentController::class, 'cancel']);
    Route::get('payments/{payment}/receipt', [PaymentController::class, 'receipt']);
    Route::get('payments/{payment}/proof', [PaymentController::class, 'proof']);

    // Gestion locative : baux, appels de loyer, quittances, reversements.
    Route::apiResource('leases', LeaseController::class)->except(['destroy']);
    Route::post('leases/{lease}/terminate', [LeaseController::class, 'terminate']);
    Route::post('leases/{lease}/rent-calls', [LeaseController::class, 'generate']);
    Route::get('leases/{lease}/rent-calls/{rentCall}/quittance', [LeaseController::class, 'quittance']);
    Route::get('owner-payouts', [OwnerPayoutController::class, 'index']);
    Route::get('owner-payouts/owners', [OwnerPayoutController::class, 'owners']);
    Route::get('owner-payouts/{ownerPayout}/pdf', [OwnerPayoutController::class, 'pdf']);
    Route::post('owner-payouts/{ownerPayout}/cancel', [OwnerPayoutController::class, 'cancel']);
    Route::get('owners/{client}/statement', [OwnerPayoutController::class, 'statement']);
    Route::post('owners/{client}/payouts', [OwnerPayoutController::class, 'store']);

    // Caisse journalière.
    Route::get('cash-sessions', [CashSessionController::class, 'index']);
    Route::get('cash-sessions/current', [CashSessionController::class, 'current']);
    Route::put('cash-sessions/current', [CashSessionController::class, 'open']);
    Route::post('cash-sessions/current/movements', [CashSessionController::class, 'storeMovement']);
    Route::get('cash-sessions/{cashSession}', [CashSessionController::class, 'show']);
    Route::post('cash-sessions/{cashSession}/close', [CashSessionController::class, 'close']);

    // Administration (RBAC) : comptes, rôles, paramètres, site, journal.
    Route::apiResource('users', UserController::class);
    Route::get('roles', [RoleController::class, 'index']);
    Route::get('roles/{role}', [RoleController::class, 'show']);
    Route::get('permissions', [RoleController::class, 'permissions']);
    Route::post('roles', [RoleController::class, 'store']);
    Route::put('roles/{role}', [RoleController::class, 'update']);
    Route::post('roles/{role}/duplicate', [RoleController::class, 'duplicate']);
    Route::delete('roles/{role}', [RoleController::class, 'destroy']);

    Route::middleware('can:settings.manage')->group(function () {
        Route::put('settings/company', [CompanySettingsController::class, 'update']);
        Route::post('settings/company/logo', [CompanySettingsController::class, 'updateLogo']);
        Route::delete('settings/company/logo', [CompanySettingsController::class, 'destroyLogo']);
    });
    Route::middleware('can:site.manage')->group(function () {
        Route::get('settings/site', [SiteSettingsController::class, 'show']);
        Route::post('settings/site/images', [SiteSettingsController::class, 'storeImage']);
        Route::put('settings/site/{section}', [SiteSettingsController::class, 'update'])->whereIn('section', SiteContent::SECTIONS);
        Route::delete('settings/site/{section}', [SiteSettingsController::class, 'reset'])->whereIn('section', SiteContent::SECTIONS);
    });
    Route::get('activity-logs', [ActivityLogController::class, 'index'])->middleware('can:activity.view');
});
