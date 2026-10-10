<?php

namespace App\Policies;

use App\Enums\Role;
use App\Models\Invoice;
use App\Models\User;

/**
 * Factures (droits par défaut, à valider avec le dirigeant) :
 * - le comptable prépare, émet et corrige (avoir) les factures, et annule les encaissements ;
 * - les agents et commerciaux consultent et encaissent (paiements reçus sur le terrain) ;
 * - le dirigeant fait tout (Gate::before).
 */
class InvoicePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasRole(Role::Comptable, Role::Agent, Role::Commercial);
    }

    public function view(User $user, Invoice $invoice): bool
    {
        return $this->viewAny($user);
    }

    public function create(User $user): bool
    {
        return $user->hasRole(Role::Comptable);
    }

    public function update(User $user, Invoice $invoice): bool
    {
        return $user->hasRole(Role::Comptable);
    }

    public function delete(User $user, Invoice $invoice): bool
    {
        return $user->hasRole(Role::Comptable);
    }

    public function recordPayment(User $user, Invoice $invoice): bool
    {
        return $user->hasRole(Role::Comptable, Role::Agent, Role::Commercial);
    }

    public function cancelPayment(User $user): bool
    {
        return $user->hasRole(Role::Comptable);
    }

    /**
     * Tenir sa propre caisse du jour : quiconque encaisse.
     */
    public function useCash(User $user): bool
    {
        return $user->hasRole(Role::Comptable, Role::Agent, Role::Commercial);
    }

    /**
     * Caisses de toute l'équipe (sinon chacun ne voit que la sienne).
     */
    public function viewAllCash(User $user): bool
    {
        return $user->hasRole(Role::Comptable);
    }
}
