@php use App\Support\InvoicePdf; use App\Support\PhoneNumber; $lease = $settlement->lease; @endphp
<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><title>Caution {{ $settlement->number }}</title>@include('pdf._styles')</head>
<body>
<table class="header">
    <tr>
        @include('pdf._company')
        <td class="right">
            <div class="doc-title">RESTITUTION DE CAUTION</div>
            <div style="font-size: 12px; font-weight: bold">{{ $settlement->number }}</div>
            <div style="margin-top: 6px">Bail {{ $lease->reference }}<br>Le {{ $settlement->settled_on->format('d/m/Y') }}</div>
        </td>
    </tr>
</table>

<table style="margin-top: 14px">
    <tr>
        <td class="box" style="width: 50%">
            <span class="muted" style="font-size: 9px">LOGEMENT</span><br>
            <strong>{{ $lease->property->title }}</strong><br>
            Bail du {{ $lease->start_date->format('d/m/Y') }} au {{ ($lease->terminated_on ?? $lease->end_date)?->format('d/m/Y') }}
            @if ($settlement->exitInspection)<br>État des lieux de sortie du {{ $settlement->exitInspection->inspected_on->format('d/m/Y') }}@endif
        </td>
        <td style="width: 2%"></td>
        <td class="box">
            <span class="muted" style="font-size: 9px">LOCATAIRE</span><br>
            <strong style="font-size: 12px">{{ $lease->tenant->name }}</strong><br>
            @if ($lease->tenant->phone)Tél. {{ PhoneNumber::format($lease->tenant->phone) }}@endif
        </td>
    </tr>
</table>

<table class="lines" style="margin-top: 14px">
    <thead><tr><th>Détail</th><th class="right" style="width: 28%">Montant (FCFA)</th></tr></thead>
    <tbody>
        <tr><td><strong>Caution encaissée</strong></td><td class="right"><strong>{{ InvoicePdf::money($settlement->deposit_held) }}</strong></td></tr>
        @foreach ($retained as $payment)
            <tr>
                <td>Loyer impayé {{ $payment->invoice->rentCall?->period->locale('fr')->translatedFormat('F Y') }} (facture {{ $payment->invoice->number }})</td>
                <td class="right">− {{ InvoicePdf::money($payment->amount) }}</td>
            </tr>
        @endforeach
        @foreach ($settlement->deductions as $deduction)
            <tr><td>{{ $deduction['label'] }}</td><td class="right">− {{ InvoicePdf::money((int) $deduction['amount']) }}</td></tr>
        @endforeach
    </tbody>
</table>

<table style="margin-top: 10px">
    <tr>
        <td style="width: 50%"></td>
        <td>
            <table class="totals">
                @if ($settlement->arrears_retained > 0)<tr><td>Loyers retenus</td><td class="right">{{ InvoicePdf::money($settlement->arrears_retained) }} FCFA</td></tr>@endif
                @if ($settlement->deductions_total > 0)<tr><td>Réparations et autres retenues</td><td class="right">{{ InvoicePdf::money($settlement->deductions_total) }} FCFA</td></tr>@endif
                <tr class="grand"><td>Restitué au locataire</td><td class="right">{{ InvoicePdf::money($settlement->refund) }} FCFA</td></tr>
                @if ($settlement->balance_due > 0)
                    <tr><td style="color: #b91c1c"><strong>Reste dû par le locataire</strong></td><td class="right" style="color: #b91c1c"><strong>{{ InvoicePdf::money($settlement->balance_due) }} FCFA</strong></td></tr>
                @endif
            </table>
        </td>
    </tr>
</table>

@if ($settlement->refund > 0)
    <div class="box" style="margin-top: 12px; line-height: 1.6">
        Somme de <strong>{{ InvoicePdf::money($settlement->refund) }} FCFA</strong>@if ($inWords) ({{ $inWords }})@endif
        rendue le {{ $settlement->settled_on->format('d/m/Y') }} par {{ $settlement->refund_method?->label() }}@if ($settlement->refund_reference) (réf. {{ $settlement->refund_reference }})@endif.
    </div>
@endif
@if ($settlement->balance_due > 0)
    <p style="margin-top: 8px">Les retenues dépassent la caution : le reste dû fait l'objet d'une facture séparée{{ $settlement->balanceInvoice?->number ? ' ('.$settlement->balanceInvoice->number.')' : '' }}.</p>
@endif
@if ($settlement->note)<p class="muted">{{ $settlement->note }}</p>@endif

<table style="margin-top: 26px">
    <tr>
        <td style="width: 50%">Pour l'agence<br><br><br><span class="muted">Signature</span></td>
        <td>Le locataire, « reçu la somme ci-dessus »<br><br><br><span class="muted">Signature</span></td>
    </tr>
</table>

<div class="footer">
    {{ $company->legal_name ?: $company->trade_name }} · Fait à {{ $company->city ?? 'Dakar' }}, le {{ $settlement->settled_on->format('d/m/Y') }}
    @if ($company->ninea) · NINEA {{ $company->ninea }}@endif
</div>
</body>
</html>
