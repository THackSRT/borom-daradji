<?php

namespace App\Console\Commands;

use App\Enums\Role;
use App\Models\User;
use App\Support\PhoneNumber;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

/**
 * Crée le premier compte dirigeant lors de la mise en service.
 */
#[Signature('borom:create-director {--name=} {--email=} {--phone=}')]
#[Description('Crée un compte dirigeant (premier accès à l\'application)')]
class CreateDirector extends Command
{
    public function handle(): int
    {
        $data = [
            'name' => $this->option('name') ?? $this->ask('Nom complet'),
            'email' => Str::lower((string) ($this->option('email') ?? $this->ask('Email'))),
            'phone' => PhoneNumber::normalize($this->option('phone') ?? $this->ask('Téléphone (facultatif)')),
            'password' => $this->secret('Mot de passe (10 caractères minimum, lettres et chiffres)'),
        ];

        $validator = Validator::make($data, [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email'],
            'phone' => ['nullable', 'unique:users,phone'],
            'password' => ['required', Password::min(10)->letters()->numbers()],
        ]);

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        $user = User::create([...$validator->validated(), 'roles' => [Role::Dirigeant]]);

        $this->info("Compte dirigeant créé : {$user->email}");

        return self::SUCCESS;
    }
}
