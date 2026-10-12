@php use App\Support\InvoicePdf; $lease = $call->lease; $lastPayment = $call->invoice->payments->whereNull('cancelled_at')->sortByDesc('paid_on')->first(); @endphp
<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><title>Quittance {{ $month }}</title>@include('pdf._styles')</head>
<body>
<table class="header">
    <tr>
        @include('pdf._company')
        <td class="right">
            <div class="doc-title">QUITTANCE DE LOYER</div>
            <div style="font-size: 12px; font-weight: bold">{{ ucfirst($month) }}</div>
            <div style="margin-top: 6px">Bail {{ $lease->reference }}</div>
        </td>
    </tr>
</table>

<div class="box" style="margin-top: 14px; font-size: 11.5px; line-height: 1.7">
    Je soussigné(e), {{ $company->legal_name ?: $company->trade_name }}{{ $lease->owner ? ', mandataire de '.$lease->owner->name.', propriétaire' : '' }},
    déclare avoir reçu de <strong>{{ $lease->tenant->name }}</strong>
    la somme de <strong>{{ InvoicePdf::money($call->invoice->total) }} FCFA</strong>@if ($inWords) ({{ $inWords }})@endif,
    au titre du loyer et des charges de <strong>{{ $month }}</strong> pour le logement :
    <strong>{{ $lease->property->title }}</strong>@if ($lease->property->neighborhood), {{ $lease->property->neighborhood }}@endif, {{ $lease->property->city }}.
</div>

<table style="margin-top: 12px">
    <tr>
        <td style="width: 60%">
            @foreach ($call->invoice->lines as $line)
                {{ $line->description }} : {{ InvoicePdf::money($line->amount + $line->vat_amount) }} FCFA<br>
            @endforeach
            <span class="muted">Facture {{ $call->invoice->number }}@if ($lastPayment) · réglée le {{ $lastPayment->paid_on->format('d/m/Y') }}@endif</span>
        </td>
        <td class="right"><span class="stamp">LOYER PAYÉ</span></td>
    </tr>
</table>

<p class="muted" style="margin-top: 14px; font-size: 9px">Cette quittance annule tous les reçus donnés pour ce mois. Elle ne libère pas le locataire des sommes dues pour d'autres périodes.</p>

<div class="footer">
    {{ $company->legal_name ?: $company->trade_name }} · Fait à {{ $company->city ?? 'Dakar' }}, le {{ now()->format('d/m/Y') }}
    @if ($company->ninea) · NINEA {{ $company->ninea }}@endif
</div>
</body>
</html>
