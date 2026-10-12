@php
    use App\Support\InvoicePdf;
    use App\Support\PhoneNumber;
    $qty = fn ($v) => rtrim(rtrim(number_format((float) $v, 2, ',', ' '), '0'), ',');
    $rate = fn ($v) => rtrim(rtrim(number_format((float) $v, 2, ',', ''), '0'), ',');
    $draft = $quote->is_template || $quote->status->value === 'brouillon';
@endphp
<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><title>Devis {{ $quote->number }}</title>@include('pdf._styles')
<style>
    .lot td { background: #f3f4f6; font-weight: bold; padding: 6px; }
    .lot-total td { padding: 4px 6px; font-weight: bold; border-bottom: 1px solid #d1d5db; }
</style>
</head>
<body>
@if ($draft)<div class="draft">{{ $quote->is_template ? 'MODÈLE' : 'BROUILLON' }}</div>@endif

<table class="header">
    <tr>
        @include('pdf._company')
        <td class="right">
            <div class="doc-title">DEVIS</div>
            <div style="font-size: 12px; font-weight: bold; margin-top: 2px">{{ $quote->number ?? ($quote->template_name ?? 'Modèle') }}</div>
            <div style="margin-top: 6px">
                Date : {{ ($quote->issue_date ?? today())->format('d/m/Y') }}<br>
                @if ($quote->valid_until)Valable jusqu'au : <strong>{{ $quote->valid_until->format('d/m/Y') }}</strong>@endif
            </div>
        </td>
    </tr>
</table>

<table style="margin-top: 16px">
    <tr>
        <td style="width: 50%; vertical-align: top">
            <span class="muted" style="font-size: 9px">OBJET</span><br>
            <strong style="font-size: 12px">{{ $quote->title }}</strong>
            @if ($quote->site_address)<br>Lieu des travaux : {{ $quote->site_address }}@endif
            @if ($quote->property)<br>Bien : {{ $quote->property->reference }} — {{ $quote->property->title }}@endif
        </td>
        <td class="box">
            <span class="muted" style="font-size: 9px">CLIENT</span><br>
            @if ($quote->client)
                <strong style="font-size: 12px">{{ $quote->client->name }}</strong><br>
                @if ($quote->client->address){{ $quote->client->address }}<br>@endif
                @if ($quote->client->phone)Tél. {{ PhoneNumber::format($quote->client->phone) }}@endif
            @else
                <span class="muted">—</span>
            @endif
        </td>
    </tr>
</table>

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
        @foreach ($quote->lots as $i => $lot)
            <tr class="lot"><td colspan="5">Lot {{ $i + 1 }} — {{ $lot->title }}</td></tr>
            @foreach ($lot->lines as $line)
                <tr>
                    <td>{{ $line->designation }}</td>
                    <td class="right">{{ $qty($line->quantity) }} {{ $line->unit }}</td>
                    <td class="right">{{ InvoicePdf::money($line->unit_price) }}</td>
                    <td class="right">{{ $rate($line->vat_rate) }} %</td>
                    <td class="right">{{ InvoicePdf::money($line->amount) }}</td>
                </tr>
            @endforeach
            <tr class="lot-total"><td colspan="4" class="right">Total lot {{ $i + 1 }}@if ((float) $quote->discount_rate > 0) (après remise)@endif</td><td class="right">{{ InvoicePdf::money($lot->total_ht) }}</td></tr>
        @endforeach
    </tbody>
</table>

<table style="margin-top: 10px">
    <tr>
        <td style="width: 55%; vertical-align: top; padding-right: 20px">
            @if ($inWords && ! $quote->is_template)
                <p>Arrêté le présent devis à la somme de :<br><strong>{{ $inWords }}</strong> TTC.</p>
            @endif
            @if ((float) $quote->deposit_rate > 0)
                <p>Acompte à la commande : <strong>{{ $rate($quote->deposit_rate) }} %</strong>, soit {{ InvoicePdf::money($quote->depositAmount()) }} FCFA TTC.</p>
            @endif
        </td>
        <td>
            <table class="totals">
                @if ($quote->discount_amount > 0)
                    <tr><td>Total HT avant remise</td><td class="right">{{ InvoicePdf::money($quote->subtotal) }} FCFA</td></tr>
                    <tr><td>Remise {{ $rate($quote->discount_rate) }} %</td><td class="right">− {{ InvoicePdf::money($quote->discount_amount) }} FCFA</td></tr>
                @endif
                <tr><td>Total HT</td><td class="right">{{ InvoicePdf::money($quote->total_ht) }} FCFA</td></tr>
                <tr><td>TVA</td><td class="right">{{ InvoicePdf::money($quote->vat_total) }} FCFA</td></tr>
                <tr class="grand"><td>Total TTC</td><td class="right">{{ InvoicePdf::money($quote->total) }} FCFA</td></tr>
            </table>
        </td>
    </tr>
</table>

@if ($quote->conditions)
    <div class="box" style="margin-top: 12px; font-size: 9.5px"><span class="muted" style="font-size: 9px">CONDITIONS</span><br>{!! nl2br(e($quote->conditions)) !!}</div>
@endif

<table style="margin-top: 22px">
    <tr>
        <td style="width: 50%">Pour l'entreprise<br><br><br><span class="muted">Signature</span></td>
        <td class="box" style="height: 70px; vertical-align: top">« Bon pour accord », date et signature du client</td>
    </tr>
</table>

<div class="footer">
    {{ $company->legal_name ?: $company->trade_name }}
    @if ($company->ninea) · NINEA {{ $company->ninea }}@endif
    @if ($company->rccm) · RCCM {{ $company->rccm }}@endif
</div>
</body>
</html>
