<?php

use App\Support\PermissionCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Passage au RBAC : crée les permissions et les rôles par défaut, reprend les rôles de chaque compte
 * (ancienne colonne JSON users.roles), puis supprime cette colonne.
 */
return new class extends Migration
{
    public function up(): void
    {
        PermissionCatalog::sync();

        $roleIds = DB::table('roles')->pluck('id', 'name');
        foreach (DB::table('users')->select('id', 'roles')->get() as $user) {
            foreach (json_decode($user->roles ?? '[]', true) ?: [] as $name) {
                if (isset($roleIds[$name])) {
                    DB::table('model_has_roles')->insertOrIgnore([
                        'role_id' => $roleIds[$name],
                        'model_type' => 'user',
                        'model_id' => $user->id,
                    ]);
                }
            }
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('roles');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->json('roles')->nullable();
        });

        $assignments = DB::table('model_has_roles')
            ->join('roles', 'roles.id', '=', 'model_has_roles.role_id')
            ->where('model_type', 'user')
            ->get(['model_id', 'roles.name']);

        foreach ($assignments->groupBy('model_id') as $userId => $rows) {
            DB::table('users')->where('id', $userId)->update(['roles' => json_encode($rows->pluck('name')->all())]);
        }
    }
};
