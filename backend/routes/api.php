<?php

use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ClientController;
use App\Http\Controllers\Api\ClientDocumentController;
use App\Http\Controllers\Api\CompanySettingsController;
use App\Http\Controllers\Api\InteractionController;
use App\Http\Controllers\Api\MandateController;
use App\Http\Controllers\Api\MetaController;
use App\Http\Controllers\Api\PropertyCheckController;
use App\Http\Controllers\Api\PropertyController;
use App\Http\Controllers\Api\PropertyDocumentController;
use App\Http\Controllers\Api\PropertyPhotoController;
use App\Http\Controllers\Api\PropertyStatusController;
use App\Http\Controllers\Api\Public\LeadController;
use App\Http\Controllers\Api\Public\PublicPropertyController;
use App\Http\Controllers\Api\SearchCriterionController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\VisitController;
use Illuminate\Support\Facades\Route;

// Public : site vitrine et connexion.
Route::prefix('public')->group(function () {
    Route::get('company', [CompanySettingsController::class, 'showPublic']);
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

    // Administration : réservée au dirigeant.
    Route::middleware('can:administrate')->group(function () {
        Route::apiResource('users', UserController::class);
        Route::put('settings/company', [CompanySettingsController::class, 'update']);
        Route::post('settings/company/logo', [CompanySettingsController::class, 'updateLogo']);
        Route::get('activity-logs', [ActivityLogController::class, 'index']);
    });
});
