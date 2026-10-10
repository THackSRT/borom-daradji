<?php

namespace App\Policies;

use App\Models\Invoice;
use App\Models\User;

/**
 * Factures, encaissements et caisses : permissions « invoices.* », « payments.* » et « cash.view_all ».
 */
class InvoicePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('invoices.view');
    }

    public function view(User $user, Invoice $invoice): bool
    {
        return $user->hasPermission('invoices.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermission('invoices.manage');
    }

    public function update(User $user, Invoice $invoice): bool
    {
        return $user->hasPermission('invoices.manage');
    }

    public function delete(User $user, Invoice $invoice): bool
    {
        return $user->hasPermission('invoices.manage');
    }

    public function issue(User $user, Invoice $invoice): bool
    {
        return $user->hasPermission('invoices.issue');
    }

    public function credit(User $user, Invoice $invoice): bool
    {
        return $user->hasPermission('invoices.credit');
    }

    public function recordPayment(User $user, Invoice $invoice): bool
    {
        return $user->hasPermission('payments.create');
    }

    public function cancelPayment(User $user): bool
    {
        return $user->hasPermission('payments.cancel');
    }

    /**
     * Tenir sa propre caisse du jour : quiconque encaisse.
     */
    public function useCash(User $user): bool
    {
        return $user->hasPermission('payments.create', 'cash.view_all');
    }

    public function viewAllPayments(User $user): bool
    {
        return $user->hasPermission('payments.view_all');
    }

    /**
     * Caisses de toute l'équipe (sinon chacun ne voit que la sienne).
     */
    public function viewAllCash(User $user): bool
    {
        return $user->hasPermission('cash.view_all');
    }
}
