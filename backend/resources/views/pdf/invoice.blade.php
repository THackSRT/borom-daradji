@php
    use App\Support\InvoicePdf;
    $isCredit = $invoice->isCreditNote();
    $title = $isCredit ? 'AVOIR' : 'FACTURE';
@endphp
<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><title>{{ $title }} {{ $invoice->number }}</title>@include('pdf._styles')</head>
<body>
@if ($invoice->isDraft())<div class="draft">BROUILLON</div>@endif

<table class="header">
    <tr>
        @include('pdf._company')
        <td class="right">
            <div class="doc-title">{{ $title }}</div>
            <div style="font-size: 12px; font-weight: bold; margin-top: 2px">{{ $invoice->number ?? 'Brouillon — sans valeur' }}</div>
            <div style="margin-top: 6px">
                Date : {{ ($invoice->issue_date ?? today())->format('d/m/Y') }}<br>
                @if ($invoice->due_date && ! $isCredit)Échéance : <strong>{{ $invoice->due_date->format('d/m/Y') }}</strong><br>@endif
                @if ($isCredit && $invoice->creditedInvoice)Sur la facture {{ $invoice->creditedInvoice->number }}<br>@endif
            </div>
        </td>
    </tr>
</table>

<table style="margin-top: 18px">
    <tr>
        <td style="width: 50%"></td>
        <td class="box">
            <span class="muted" style="font-size: 9px">{{ $isCredit ? 'AVOIR À' : 'FACTURÉ À' }}</span><br>
            <strong style="font-size: 12px">{{ $invoice->client->name }}</strong><br>
            @if ($invoice->client->address){{ $invoice->client->address }}<br>@endif
            @if ($invoice->client->city){{ $invoice->client->city }}<br>@endif
            @if ($invoice->client->phone)Tél. {{ \App\Support\PhoneNumber::format($invoice->client->phone) }}@endif
        </td>
    </tr>
</table>

@if ($invoice->property)
    <p style="margin-top: 14px">Bien concerné : <strong>{{ $invoice->property->reference }}</strong> — {{ $invoice->property->title }}</p>
@endif

<table class="lines" style="margin-top: 14px">
    <thead>
        <tr>
            <th style="width: 46%">Désignation</th>
            <th class="right">Qté</th>
            <th class="right">Prix unitaire</th>
            <th class="right">TVA</th>
            <th class="right">Montant HT</th>
        </tr>
    </thead>
    <tbody>
        @foreach ($invoice->lines as $line)
            <tr>
                <td>{{ $line->description }}</td>
                <td class="right">{{ rtrim(rtrim(number_format((float) $line->quantity, 2, ',', ' '), '0'), ',') }} {{ $line->unit }}</td>
                <td class="right">{{ InvoicePdf::money($line->unit_price) }}</td>
                <td class="right">{{ rtrim(rtrim(number_format((float) $line->vat_rate, 2, ',', ''), '0'), ',') }} %</td>
                <td class="right">{{ InvoicePdf::money($line->amount) }}</td>
            </tr>
        @endforeach
    </tbody>
</table>

<table style="margin-top: 10px">
    <tr>
        <td style="width: 55%; vertical-align: top; padding-right: 20px">
            @if ($inWords)
                <p>{{ $isCredit ? 'Arrêté le présent avoir' : 'Arrêtée la présente facture' }} à la somme de :<br><strong>{{ $inWords }}</strong>.</p>
            @endif
            @if ($invoice->notes)<p class="muted">{!! nl2br(e($invoice->notes)) !!}</p>@endif
        </td>
        <td>
            <table class="totals">
                <tr><td>Total HT</td><td class="right">{{ InvoicePdf::money($invoice->subtotal) }} FCFA</td></tr>
                <tr><td>TVA</td><td class="right">{{ InvoicePdf::money($invoice->vat_total) }} FCFA</td></tr>
                <tr class="grand"><td>Total TTC</td><td class="right">{{ InvoicePdf::money($invoice->total) }} FCFA</td></tr>
                @if (! $isCredit && ! $invoice->isDraft() && ($invoice->paid_total > 0 || $invoice->credited_total > 0))
                    @if ($invoice->credited_total > 0)<tr><td>Avoirs</td><td class="right">− {{ InvoicePdf::money($invoice->credited_total) }} FCFA</td></tr>@endif
                    @if ($invoice->paid_total > 0)<tr><td>Déjà réglé</td><td class="right">− {{ InvoicePdf::money($invoice->paid_total) }} FCFA</td></tr>@endif
                    <tr><td><strong>Reste à payer</strong></td><td class="right"><strong>{{ InvoicePdf::money(max(0, $invoice->balance())) }} FCFA</strong></td></tr>
                @endif
            </table>
        </td>
    </tr>
</table>

@if (! $isCredit)
    <div class="box" style="margin-top: 18px">
        <strong>Règlement</strong> : espèces à l'agence, Wave, Orange Money{{ $company->bank_name || $company->bank_account ? ', ou virement : '.trim($company->bank_name.' '.$company->bank_account) : '' }}.
        Merci de rappeler le numéro {{ $invoice->number ?? 'de facture' }}.
    </div>
@endif

<div class="footer">
    {{ $company->legal_name ?: $company->trade_name }}
    @if ($company->ninea) · NINEA {{ $company->ninea }}@endif
    @if ($company->rccm) · RCCM {{ $company->rccm }}@endif
    @if ($company->invoice_footer)<br>{{ $company->invoice_footer }}@endif
</div>
</body>
</html>
