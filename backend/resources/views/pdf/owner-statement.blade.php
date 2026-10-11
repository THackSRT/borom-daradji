@php use App\Support\InvoicePdf; @endphp
<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><title>Relevé {{ $payout->number }}</title>@include('pdf._styles')</head>
<body>
@if ($payout->isCancelled())<div class="draft">ANNULÉ</div>@endif
<table class="header">
    <tr>
        @include('pdf._company')
        <td class="right">
            <div class="doc-title">RELEVÉ DE GÉRANCE</div>
            <div style="font-size: 12px; font-weight: bold">{{ $payout->number }}</div>
            <div style="margin-top: 6px">Arrêté à fin {{ $month }}<br>Versé le {{ $payout->paid_on->format('d/m/Y') }}</div>
        </td>
    </tr>
</table>

<table style="margin-top: 14px">
    <tr>
        <td style="width: 50%"></td>
        <td class="box">
            <span class="muted" style="font-size: 9px">PROPRIÉTAIRE</span><br>
            <strong style="font-size: 12px">{{ $payout->owner->name }}</strong><br>
            @if ($payout->owner->phone)Tél. {{ \App\Support\PhoneNumber::format($payout->owner->phone) }}@endif
        </td>
    </tr>
</table>

<table class="lines" style="margin-top: 14px">
    <thead>
        <tr><th>Bien et locataire</th><th>Mois</th><th>Encaissé le</th><th class="right">Loyer encaissé</th><th class="right">Commission</th></tr>
    </thead>
    <tbody>
        @foreach ($payout->details['lines'] as $line)
            <tr>
                <td>{{ $line['property'] }}<br><span class="muted">{{ $line['tenant'] }} · {{ $line['lease'] }}</span></td>
                <td>{{ $line['month'] }}</td>
                <td>{{ \Carbon\Carbon::parse($line['paid_on'])->format('d/m/Y') }}</td>
                <td class="right">{{ InvoicePdf::money($line['amount']) }}</td>
                <td class="right">{{ InvoicePdf::money($line['commission']) }} ({{ rtrim(rtrim(number_format($line['commission_rate'], 2, ',', ''), '0'), ',') }} %)</td>
            </tr>
        @endforeach
    </tbody>
</table>

<table style="margin-top: 10px">
    <tr>
        <td style="width: 50%"></td>
        <td>
            <table class="totals">
                <tr><td>Loyers encaissés</td><td class="right">{{ InvoicePdf::money($payout->collected) }} FCFA</td></tr>
                <tr><td>Commission de gestion</td><td class="right">− {{ InvoicePdf::money($payout->commission) }} FCFA</td></tr>
                @if ($payout->commission_vat > 0)<tr><td>TVA sur commission</td><td class="right">− {{ InvoicePdf::money($payout->commission_vat) }} FCFA</td></tr>@endif
                @foreach ($payout->details['expenses'] ?? [] as $expense)
                    <tr><td>{{ $expense['label'] }}</td><td class="right">− {{ InvoicePdf::money((int) $expense['amount']) }} FCFA</td></tr>
                @endforeach
                <tr class="grand"><td>Net reversé</td><td class="right">{{ InvoicePdf::money($payout->net) }} FCFA</td></tr>
            </table>
        </td>
    </tr>
</table>

<div class="box" style="margin-top: 16px">
    Versement par <strong>{{ $payout->method->label() }}</strong>@if ($payout->reference) (réf. {{ $payout->reference }})@endif le {{ $payout->paid_on->format('d/m/Y') }}.
    @if ($payout->note)<br>{{ $payout->note }}@endif
</div>

<div class="footer">
    {{ $company->legal_name ?: $company->trade_name }}
    @if ($company->ninea) · NINEA {{ $company->ninea }}@endif
    @if ($company->rccm) · RCCM {{ $company->rccm }}@endif
</div>
</body>
</html>
