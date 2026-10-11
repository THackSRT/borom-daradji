<?php

namespace App\Services;

use App\Enums\InvoiceStatus;
use App\Enums\InvoiceType;
use App\Models\Client;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Purchase;
use App\Models\SupplierPayment;
use App\Support\AccountingAccounts;
use Carbon\CarbonImmutable;
use DateTimeImmutable;
use Illuminate\Support\Collection;

/**
 * Exports pour le cabinet comptable (lot 5, D-056) : chaque journal donne une feuille « Écritures »
 * (journal, date, pièce, compte, compte de tiers, libellé, débit, crédit — équilibrée pièce par pièce,
 * importable après correspondance des colonnes dans Sage ou Ciel) et une feuille de détail lisible.
 * Les balances sont arrêtées à une date. Numéros de compte : App\Support\AccountingAccounts.
 */
class AccountingExport
{
    public const ENTRY_COLUMNS = ['Journal', 'Date', 'N° pièce', 'Compte', 'Compte tiers', 'Libellé', 'Débit', 'Crédit'];

    public const ENTRY_WIDTHS = [9, 12, 18, 11, 13, 50, 14, 14];

    /** @var array<string, mixed> */
    private array $accounts;

    public function __construct()
    {
        $this->accounts = AccountingAccounts::current();
    }

    /**
     * Journal des ventes : factures et avoirs émis sur la période. Facture : débit client (TTC), crédit
     * ventes de l'activité (HT) et TVA collectée ; avoir : l'inverse.
     *
     * @return list<array<string, mixed>>
     */
    public function sales(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $invoices = Invoice::query()->where('status', InvoiceStatus::Emise)
            ->whereDate('issue_date', '>=', $from->toDateString())->whereDate('issue_date', '<=', $to->toDateString())
            ->with('client:id,name')->orderBy('issue_date')->orderBy('id')->get();
        $journal = $this->accounts['journals']['sales'];
        $entries = [];
        foreach ($invoices as $invoice) {
            $sign = $invoice->type === InvoiceType::Avoir ? -1 : 1;
            $date = $invoice->issue_date->toDateTimeImmutable();
            $label = ($sign > 0 ? 'Facture ' : 'Avoir ').$invoice->number.' — '.$invoice->client->name;
            $tiers = AccountingAccounts::tiers($this->accounts['client_prefix'], $invoice->client_id);
            $entries[] = $this->entry($journal, $date, $invoice->number, $this->accounts['clients'], $tiers, $label, $sign * $invoice->total);
            $entries[] = $this->entry($journal, $date, $invoice->number, $this->accounts['sales'][$invoice->activity->value] ?? $this->accounts['sales']['autre'], '', $label, -$sign * $invoice->subtotal);
            if ($invoice->vat_total) {
                $entries[] = $this->entry($journal, $date, $invoice->number, $this->accounts['vat_collected'], '', $label, -$sign * $invoice->vat_total);
            }
        }

        return [
            ['name' => 'Écritures', 'columns' => self::ENTRY_COLUMNS, 'rows' => $entries, 'widths' => self::ENTRY_WIDTHS],
            [
                'name' => 'Factures',
                'columns' => ['Date', 'N°', 'Type', 'Activité', 'Client', 'Compte tiers', 'HT', 'TVA', 'TTC'],
                'widths' => [12, 18, 9, 22, 34, 13, 14, 14, 14],
                'rows' => $invoices->map(fn (Invoice $i) => [
                    $i->issue_date->toDateTimeImmutable(), $i->number, $i->type === InvoiceType::Avoir ? 'Avoir' : 'Facture', $i->activity->label(),
                    $i->client->name, AccountingAccounts::tiers($this->accounts['client_prefix'], $i->client_id),
                    ($i->type === InvoiceType::Avoir ? -1 : 1) * $i->subtotal, ($i->type === InvoiceType::Avoir ? -1 : 1) * $i->vat_total, ($i->type === InvoiceType::Avoir ? -1 : 1) * $i->total,
                ])->all(),
            ],
        ];
    }

    /**
     * Journal des encaissements : paiements valides sur la période. Débit trésorerie du mode (caisse,
     * Wave, banque… ; retenue sur caution : dépôts reçus), crédit client.
     *
     * @return list<array<string, mixed>>
     */
    public function collections(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $payments = Payment::query()->valid()
            ->whereDate('paid_on', '>=', $from->toDateString())->whereDate('paid_on', '<=', $to->toDateString())
            ->with(['client:id,name', 'invoice:id,number'])->orderBy('paid_on')->orderBy('id')->get();
        $journal = $this->accounts['journals']['treasury'];
        $entries = [];
        foreach ($payments as $payment) {
            $date = $payment->paid_on->toDateTimeImmutable();
            $label = "Encaissement {$payment->invoice->number} — {$payment->client->name} ({$payment->method->label()})";
            $entries[] = $this->entry($journal, $date, $payment->number, $this->accounts['treasury'][$payment->method->value] ?? '', '', $label, $payment->amount);
            $entries[] = $this->entry($journal, $date, $payment->number, $this->accounts['clients'], AccountingAccounts::tiers($this->accounts['client_prefix'], $payment->client_id), $label, -$payment->amount);
        }

        return [
            ['name' => 'Écritures', 'columns' => self::ENTRY_COLUMNS, 'rows' => $entries, 'widths' => self::ENTRY_WIDTHS],
            [
                'name' => 'Encaissements',
                'columns' => ['Date', 'Reçu', 'Facture', 'Client', 'Compte tiers', 'Mode', 'Référence', 'Montant'],
                'widths' => [12, 18, 18, 34, 13, 18, 22, 14],
                'rows' => $payments->map(fn (Payment $p) => [
                    $p->paid_on->toDateTimeImmutable(), $p->number, $p->invoice->number, $p->client->name,
                    AccountingAccounts::tiers($this->accounts['client_prefix'], $p->client_id), $p->method->label(), $p->reference, $p->amount,
                ])->all(),
            ],
        ];
    }

    /**
     * Journal des achats (achats valides reçus sur la période : débit achats HT et TVA déductible,
     * crédit fournisseur TTC) et règlements des fournisseurs (débit fournisseur, crédit trésorerie).
     *
     * @return list<array<string, mixed>>
     */
    public function purchases(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $purchases = Purchase::query()->valid()
            ->whereDate('received_on', '>=', $from->toDateString())->whereDate('received_on', '<=', $to->toDateString())
            ->with('supplier:id,name')->orderBy('received_on')->orderBy('id')->get();
        $payments = SupplierPayment::query()->whereNull('cancelled_at')
            ->whereDate('paid_on', '>=', $from->toDateString())->whereDate('paid_on', '<=', $to->toDateString())
            ->with('purchase.supplier:id,name')->orderBy('paid_on')->orderBy('id')->get();
        $entries = [];
        $journal = $this->accounts['journals']['purchases'];
        foreach ($purchases as $purchase) {
            $date = $purchase->received_on->toDateTimeImmutable();
            $label = "Achat {$purchase->number} — {$purchase->supplier->name}".($purchase->supplier_reference ? " ({$purchase->supplier_reference})" : '');
            $tiers = AccountingAccounts::tiers($this->accounts['supplier_prefix'], $purchase->supplier_id);
            $entries[] = $this->entry($journal, $date, $purchase->number, $this->accounts['purchases'], '', $label, $purchase->subtotal);
            if ($purchase->vat_total) {
                $entries[] = $this->entry($journal, $date, $purchase->number, $this->accounts['vat_deductible'], '', $label, $purchase->vat_total);
            }
            $entries[] = $this->entry($journal, $date, $purchase->number, $this->accounts['suppliers'], $tiers, $label, -$purchase->total);
        }
        $treasury = $this->accounts['journals']['treasury'];
        foreach ($payments as $payment) {
            $purchase = $payment->purchase;
            $date = $payment->paid_on->toDateTimeImmutable();
            $label = "Règlement {$purchase->number} — {$purchase->supplier->name} ({$payment->method->label()})";
            $entries[] = $this->entry($treasury, $date, $purchase->number, $this->accounts['suppliers'], AccountingAccounts::tiers($this->accounts['supplier_prefix'], $purchase->supplier_id), $label, $payment->amount);
            $entries[] = $this->entry($treasury, $date, $purchase->number, $this->accounts['treasury'][$payment->method->value] ?? '', '', $label, -$payment->amount);
        }

        return [
            ['name' => 'Écritures', 'columns' => self::ENTRY_COLUMNS, 'rows' => $entries, 'widths' => self::ENTRY_WIDTHS],
            [
                'name' => 'Achats',
                'columns' => ['Date', 'N°', 'Fournisseur', 'Compte tiers', 'Réf. fournisseur', 'HT', 'TVA', 'TTC', 'Payé', 'Reste', 'Échéance'],
                'widths' => [12, 16, 32, 13, 18, 14, 12, 14, 14, 14, 12],
                'rows' => $purchases->map(fn (Purchase $p) => [
                    $p->received_on->toDateTimeImmutable(), $p->number, $p->supplier->name, AccountingAccounts::tiers($this->accounts['supplier_prefix'], $p->supplier_id),
                    $p->supplier_reference, $p->subtotal, $p->vat_total, $p->total, $p->paid_total, $p->balance(), $p->due_date?->toDateTimeImmutable(),
                ])->all(),
            ],
            [
                'name' => 'Règlements fournisseurs',
                'columns' => ['Date', 'Achat', 'Fournisseur', 'Mode', 'Référence', 'Montant'],
                'widths' => [12, 16, 32, 18, 22, 14],
                'rows' => $payments->map(fn (SupplierPayment $p) => [
                    $p->paid_on->toDateTimeImmutable(), $p->purchase->number, $p->purchase->supplier->name, $p->method->label(), $p->reference, $p->amount,
                ])->all(),
            ],
        ];
    }

    /**
     * Balance clients à une date : facturé, avoirs, encaissé, solde et part échue, par client.
     *
     * @return list<array<string, mixed>>
     */
    public function clientBalance(CarbonImmutable $at): array
    {
        $invoices = Invoice::query()->where('status', InvoiceStatus::Emise)->whereDate('issue_date', '<=', $at->toDateString())
            ->get(['id', 'client_id', 'type', 'total', 'due_date', 'issue_date']);
        $paid = Payment::query()->valid()->whereDate('paid_on', '<=', $at->toDateString())
            ->selectRaw('invoice_id, sum(amount) as total')->groupBy('invoice_id')->pluck('total', 'invoice_id');
        $creditedByInvoice = Invoice::query()->where('type', InvoiceType::Avoir)->where('status', InvoiceStatus::Emise)
            ->whereDate('issue_date', '<=', $at->toDateString())->selectRaw('credited_invoice_id, sum(total) as total')
            ->groupBy('credited_invoice_id')->pluck('total', 'credited_invoice_id');

        $rows = $invoices->groupBy('client_id')->map(function (Collection $rows, $clientId) use ($paid, $creditedByInvoice, $at) {
            $facts = $rows->where('type', InvoiceType::Facture);
            $billed = (int) $facts->sum('total');
            $credits = (int) $rows->where('type', InvoiceType::Avoir)->sum('total');
            $collected = (int) $facts->sum(fn ($i) => (int) ($paid[$i->id] ?? 0));
            $overdue = (int) $facts->filter(fn ($i) => $i->due_date && $i->due_date->lt($at))
                ->sum(fn ($i) => max(0, $i->total - (int) ($creditedByInvoice[$i->id] ?? 0) - (int) ($paid[$i->id] ?? 0)));

            return ['client_id' => (int) $clientId, 'billed' => $billed, 'credits' => $credits, 'collected' => $collected, 'balance' => $billed - $credits - $collected, 'overdue' => $overdue];
        })->filter(fn ($r) => $r['billed'] || $r['credits'] || $r['collected']);
        $clients = Client::withTrashed()->whereIn('id', $rows->keys())->get(['id', 'name', 'phone'])->keyBy('id');

        return [[
            'name' => 'Balance clients',
            'columns' => ['Compte', 'Compte tiers', 'Client', 'Téléphone', 'Facturé TTC', 'Avoirs', 'Encaissé', 'Solde', 'Dont échu'],
            'widths' => [10, 13, 34, 16, 15, 13, 15, 15, 15],
            'rows' => $rows->sortBy(fn ($r) => $clients[$r['client_id']]->name)->map(fn ($r) => [
                $this->accounts['clients'], AccountingAccounts::tiers($this->accounts['client_prefix'], $r['client_id']), $clients[$r['client_id']]->name,
                $clients[$r['client_id']]->phone, $r['billed'], $r['credits'], $r['collected'], $r['balance'], $r['overdue'],
            ])->values()->all(),
        ]];
    }

    /**
     * Balance fournisseurs à une date : achats, payé, solde et part échue, par fournisseur.
     *
     * @return list<array<string, mixed>>
     */
    public function supplierBalance(CarbonImmutable $at): array
    {
        $purchases = Purchase::query()->valid()->whereDate('received_on', '<=', $at->toDateString())->get(['id', 'supplier_id', 'total', 'due_date']);
        $paid = SupplierPayment::query()->whereNull('cancelled_at')->whereDate('paid_on', '<=', $at->toDateString())
            ->selectRaw('purchase_id, sum(amount) as total')->groupBy('purchase_id')->pluck('total', 'purchase_id');
        $rows = $purchases->groupBy('supplier_id')->map(fn (Collection $rows, $supplierId) => [
            'supplier_id' => (int) $supplierId,
            'purchased' => (int) $rows->sum('total'),
            'paid' => $p = (int) $rows->sum(fn ($r) => (int) ($paid[$r->id] ?? 0)),
            'balance' => (int) $rows->sum('total') - $p,
            'overdue' => (int) $rows->filter(fn ($r) => $r->due_date && $r->due_date->lt($at))->sum(fn ($r) => max(0, $r->total - (int) ($paid[$r->id] ?? 0))),
        ]);
        $suppliers = Client::withTrashed()->whereIn('id', $rows->keys())->get(['id', 'name', 'phone'])->keyBy('id');

        return [[
            'name' => 'Balance fournisseurs',
            'columns' => ['Compte', 'Compte tiers', 'Fournisseur', 'Téléphone', 'Achats TTC', 'Payé', 'Solde', 'Dont échu'],
            'widths' => [10, 13, 34, 16, 15, 15, 15, 15],
            'rows' => $rows->sortBy(fn ($r) => $suppliers[$r['supplier_id']]->name)->map(fn ($r) => [
                $this->accounts['suppliers'], AccountingAccounts::tiers($this->accounts['supplier_prefix'], $r['supplier_id']), $suppliers[$r['supplier_id']]->name,
                $suppliers[$r['supplier_id']]->phone, $r['purchased'], $r['paid'], $r['balance'], $r['overdue'],
            ])->values()->all(),
        ]];
    }

    /**
     * Ligne d'écriture : un montant positif va au débit, négatif au crédit.
     *
     * @return list<mixed>
     */
    private function entry(string $journal, DateTimeImmutable $date, ?string $piece, string $account, string $tiers, string $label, int $amount): array
    {
        return [$journal, $date, $piece, $account, $tiers ?: null, $label, $amount > 0 ? $amount : null, $amount < 0 ? -$amount : null];
    }
}
