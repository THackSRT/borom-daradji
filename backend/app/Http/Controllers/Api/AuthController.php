<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\UpdatePasswordRequest;
use App\Http\Resources\UserResource;
use App\Support\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class AuthController extends Controller
{
    public function login(LoginRequest $request): JsonResponse
    {
        $user = $request->authenticate();

        // Pas d'entrée « updated » dans le journal pour la date de connexion : l'entrée « login » suffit.
        $user->forceFill(['last_login_at' => now()])->saveQuietly();
        ActivityLogger::log('login', $user, 'Connexion depuis '.$request->string('device_name'), user: $user);

        $token = $user->createToken($request->string('device_name')->toString());

        return response()->json([
            'token' => $token->plainTextToken,
            'user' => new UserResource($user),
        ]);
    }

    public function me(Request $request): UserResource
    {
        return new UserResource($request->user());
    }

    public function logout(Request $request): Response
    {
        $request->user()->currentAccessToken()->delete();
        ActivityLogger::log('logout', $request->user());

        return response()->noContent();
    }

    public function updatePassword(UpdatePasswordRequest $request): Response
    {
        $user = $request->user();
        $user->update(['password' => $request->string('password')->toString()]);

        // Déconnecte les autres appareils : un mot de passe changé doit couper un accès volé.
        $user->tokens()->whereKeyNot($user->currentAccessToken()->getKey())->delete();

        return response()->noContent();
    }
}
