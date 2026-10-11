<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Article;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Property;
use App\Models\Purchase;
use App\Models\Quote;
use App\Models\Worksite;
use App\Services\Billing;
use App\Support\PhoneNumber;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Recherche globale (Ctrl+K) : clients, biens, chantiers, devis, factures, articles, achats — chaque
 * groupe seulement avec le droit de le consulter. Résultats au même format pour l'écran (titre,
 * sous-titre, adresse dans le back-office).
 */
class SearchController extends Controller
{
    private const LIMIT = 5;

    public function __invoke(Request $request): JsonResponse
    {
        $term = trim((string) $request->validate(['q' => ['required', 'string', 'min:2', 'max:100']])['q']);
        $user = $request->user();
        $like = "%{$term}%";
        $groups = [];

        if ($user->can('viewAny', Client::class)) {
            $phone = PhoneNumber::normalize($term);
            $digits = preg_replace('/\D+/', '', $term);
            $looksLikePhone = strlen($digits) >= 3 && preg_match('/^[\d\s.+\-]+$/', $term);
            $groups['clients'] = Client::query()
                ->where(fn ($q) => $q->whereLike('name', $like)->orWhereLike('email', $like)
                    ->orWhereLike('phone', '%'.($phone ?? ($looksLikePhone ? $digits : $term)).'%'))
                ->orderByDesc('last_contact_at')->limit(self::LIMIT)->get()
                ->map(fn (Client $c) => $this->item($c->id, $c->name, $c->phone, "/admin/clients/{$c->id}"));
        }
        if ($user->can('viewAny', Property::class)) {
            $groups['properties'] = Property::query()
                ->where(fn ($q) => $q->whereLike('title', $like)->orWhereLike('reference', $like)->orWhereLike('neighborhood', $like))
                ->latest('id')->limit(self::LIMIT)->get()
                ->map(fn (Property $p) => $this->item($p->id, $p->title, trim("{$p->reference} · {$p->neighborhood}", ' ·'), "/admin/biens/{$p->id}", $p->status->toOption()));
        }
        if ($user->hasPermission('works.view')) {
            $groups['worksites'] = Worksite::query()->with('client:id,name')
                ->where(fn ($q) => $q->whereLike('reference', $like)->orWhereLike('title', $like)->orWhereLike('address', $like)
                    ->orWhereHas('client', fn ($c) => $c->whereLike('name', $like)))
                ->latest('id')->limit(self::LIMIT)->get()
                ->map(fn (Worksite $w) => $this->item($w->id, $w->title, "{$w->reference} · {$w->client?->name}", "/admin/chantiers/{$w->id}", $w->status->toOption()));
        }
        if ($user->hasPermission('works.view', 'works.quotes')) {
            $groups['quotes'] = Quote::query()->quotes()->with('client:id,name')
                ->where(fn ($q) => $q->whereLike('number', $like)->orWhereLike('title', $like)->orWhereHas('client', fn ($c) => $c->whereLike('name', $like)))
                ->latest('id')->limit(self::LIMIT)->get()
                ->map(fn (Quote $q) => $this->item($q->id, $q->title, trim("{$q->number} · {$q->client?->name} · ".Billing::money($q->total), ' ·'), "/admin/devis/{$q->id}", $q->status->toOption()));
        }
        if ($user->hasPermission('invoices.view')) {
            $groups['invoices'] = Invoice::query()->with('client:id,name')
                ->where(fn ($q) => $q->whereLike('number', $like)->orWhereHas('client', fn ($c) => $c->whereLike('name', $like)))
                ->latest('id')->limit(self::LIMIT)->get()
                ->map(fn (Invoice $i) => $this->item($i->id, ($i->number ?? 'Brouillon').' · '.$i->client->name, Billing::money($i->total).($i->balance() > 0 ? ' · reste '.Billing::money($i->balance()) : ''), "/admin/factures/{$i->id}", $i->status->toOption()));
        }
        if ($user->hasPermission('stock.view', 'stock.sell', 'stock.purchases')) {
            $groups['articles'] = Article::query()
                ->where(fn ($q) => $q->whereLike('name', $like)->orWhereLike('reference', $like))
                ->orderBy('name')->limit(self::LIMIT)->get()
                ->map(fn (Article $a) => $this->item($a->id, $a->name, "{$a->reference} · ".rtrim(rtrim(number_format($a->quantity, 2, ',', ' '), '0'), ',')." {$a->unit} en stock", "/admin/stock/{$a->id}"));
        }
        if ($user->hasPermission('stock.purchases')) {
            $groups['purchases'] = Purchase::query()->with('supplier:id,name')
                ->where(fn ($q) => $q->whereLike('number', $like)->orWhereLike('supplier_reference', $like)->orWhereHas('supplier', fn ($c) => $c->whereLike('name', $like)))
                ->latest('id')->limit(self::LIMIT)->get()
                ->map(fn (Purchase $p) => $this->item($p->id, "{$p->number} · {$p->supplier->name}", Billing::money($p->total).($p->balance() > 0 ? ' · reste '.Billing::money($p->balance()) : ''), "/admin/achats/{$p->id}"));
        }

        return response()->json(['data' => collect($groups)->filter(fn ($items) => $items->isNotEmpty())->map(fn ($items) => $items->values())]);
    }

    /**
     * @param  array{value: string, label: string}|null  $status
     * @return array<string, mixed>
     */
    private function item(int $id, string $title, ?string $subtitle, string $url, ?array $status = null): array
    {
        return ['id' => $id, 'title' => $title, 'subtitle' => $subtitle, 'url' => $url, 'status' => $status];
    }
}
