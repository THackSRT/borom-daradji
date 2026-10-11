<?php

namespace App\Models;

use App\Models\Concerns\LogsActivity;
use Spatie\Permission\Models\Permission as SpatiePermission;

/**
 * Permission (RBAC). La liste fait foi dans App\Support\PermissionCatalog ; la table n'en est que le reflet.
 */
class Permission extends SpatiePermission
{
    use LogsActivity;

    /** Garde unique de l'application : les jetons Sanctum s'authentifient sur le fournisseur « users ». */
    protected $guard_name = 'web';
}
