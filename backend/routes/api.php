<?php

use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CompanySettingsController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Route;

// Public : site vitrine et connexion.
Route::get('public/company', [CompanySettingsController::class, 'showPublic']);
Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:20,1');

Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::get('auth/me', [AuthController::class, 'me']);
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::put('auth/password', [AuthController::class, 'updatePassword']);

    Route::get('settings/company', [CompanySettingsController::class, 'show']);

    // Administration : réservée au dirigeant.
    Route::middleware('can:administrate')->group(function () {
        Route::apiResource('users', UserController::class);
        Route::put('settings/company', [CompanySettingsController::class, 'update']);
        Route::post('settings/company/logo', [CompanySettingsController::class, 'updateLogo']);
        Route::get('activity-logs', [ActivityLogController::class, 'index']);
    });
});
