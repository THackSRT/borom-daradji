<?php

namespace App\Http\Controllers\Api;

use App\Enums\CashMovementType;
use App\Http\Controllers\Controller;
use App\Http\Resources\CashSessionResource;
use App\Models\CashSession;
use App\Models\Invoice;
use App\Services\Billing;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Caisse journalière : chacun tient la sienne ; le comptable voit et clôture celles de l'équipe.
 */
class CashSessionController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        Gate::authorize('useCash', Invoice::class);

        $query = CashSession::query()->with('user');
        if (! $request->user()->can('viewAllCash', Invoice::class)) {
            $query->where('user_id', $request->user()->id);
        } elseif ($request->filled('user_id')) {
            $query->where('user_id', $request->query('user_id'));
        }
        if ($request->filled('date')) {
            $query->whereDate('date', $request->query('date'));
        }

        return CashSessionResource::collection($query->latest('date')->latest('id')->paginate(30));
    }

    /**
     * Ma caisse d'aujourd'hui (ouverte automatiquement au premier encaissement en espèces).
     */
    public function current(Request $request): CashSessionResource
    {
        Gate::authorize('useCash', Invoice::class);

        return $this->detailed(Billing::todaySession($request->user()));
    }

    public function show(Request $request, CashSession $cashSession): CashSessionResource
    {
        $this->authorizeSession($request, $cashSession);

        return $this->detailed($cashSession);
    }

    /**
     * Fonds de caisse du matin.
     */
    public function open(Request $request): CashSessionResource
    {
        Gate::authorize('useCash', Invoice::class);
        $data = $request->validate(['opening_amount' => ['required', 'integer', 'min:0']], [], ['opening_amount' => 'fonds de caisse']);

        $session = $this->openSession($request);
        $session->update($data);

        return $this->detailed($session);
    }

    public function storeMovement(Request $request): CashSessionResource
    {
        Gate::authorize('useCash', Invoice::class);
        $data = $request->validate([
            'type' => ['required', Rule::enum(CashMovementType::class)],
            'amount' => ['required', 'integer', 'min:1'],
            'label' => ['required', 'string', 'max:255'],
        ], [], ['type' => 'type de mouvement', 'amount' => 'montant', 'label' => 'libellé']);

        $session = $this->openSession($request);
        $type = CashMovementType::from($data['type']);

        if ($type->sign() < 0 && $data['amount'] > $session->expected()) {
            throw ValidationException::withMessages(['amount' => 'Il n\'y a que '.Billing::money($session->expected()).' dans la caisse.']);
        }

        $session->movements()->create([...$data, 'created_by' => $request->user()->id]);

        return $this->detailed($session);
    }

    /**
     * Clôture : espèces comptées, écart avec le théorique ; un écart doit être expliqué.
     */
    public function close(Request $request, CashSession $cashSession): CashSessionResource
    {
        $this->authorizeSession($request, $cashSession);

        if ($cashSession->isClosed()) {
            throw ValidationException::withMessages(['session' => 'Cette caisse est déjà clôturée.']);
        }

        $data = $request->validate([
            'counted_amount' => ['required', 'integer', 'min:0'],
            'closing_note' => ['nullable', 'string', 'max:1000'],
        ], [], ['counted_amount' => 'montant compté', 'closing_note' => 'explication']);

        $expected = $cashSession->expected();
        $difference = $data['counted_amount'] - $expected;

        if ($difference !== 0 && blank($data['closing_note'] ?? null)) {
            throw ValidationException::withMessages([
                'closing_note' => 'Écart de '.Billing::money($difference).' avec le montant attendu ('.Billing::money($expected).') : expliquez-le avant de clôturer.',
            ]);
        }

        $cashSession->forceFill([
            'expected_amount' => $expected,
            'counted_amount' => $data['counted_amount'],
            'difference' => $difference,
            'closing_note' => $data['closing_note'] ?? null,
            'closed_at' => now(),
            'closed_by' => $request->user()->id,
        ])->save();

        return $this->detailed($cashSession);
    }

    private function openSession(Request $request): CashSession
    {
        $session = Billing::todaySession($request->user());
        if ($session->isClosed()) {
            throw ValidationException::withMessages(['session' => 'Votre caisse du jour est clôturée.']);
        }

        return $session;
    }

    private function authorizeSession(Request $request, CashSession $session): void
    {
        abort_unless($session->user_id === $request->user()->id || $request->user()->can('viewAllCash', Invoice::class), 403);
    }

    private function detailed(CashSession $session): CashSessionResource
    {
        return new CashSessionResource($session->load(['user', 'payments.invoice', 'payments.client', 'movements']));
    }
}
