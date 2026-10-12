<?php

namespace App\Policies;

use App\Models\Quote;
use App\Models\User;

/**
 * Devis : « works.quotes » pour les préparer et les suivre ; modèles : « works.catalog ».
 */
class QuotePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('works.view', 'works.quotes');
    }

    public function view(User $user, Quote $quote): bool
    {
        return $this->viewAny($user);
    }

    public function create(User $user): bool
    {
        return $user->hasPermission('works.quotes');
    }

    public function update(User $user, Quote $quote): bool
    {
        return $quote->is_template ? $user->hasPermission('works.catalog') : $user->hasPermission('works.quotes');
    }

    public function delete(User $user, Quote $quote): bool
    {
        return $this->update($user, $quote);
    }
}
