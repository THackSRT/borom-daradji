@php use App\Support\InvoicePdf; @endphp
<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><title>Reçu {{ $payment->number }}</title>@include('pdf._styles')</head>
<body>
@if ($payment->isCancelled())<div class="draft" style="top: 150px">ANNULÉ</div>@endif
<table class="header">
    <tr>
        @include('pdf._company')
        <td class="right">
            <div class="doc-title">REÇU</div>
            <div style="font-size: 12px; font-weight: bold">{{ $payment->number }}</div>
            <div style="margin-top: 6px">Le {{ $payment->paid_on->format('d/m/Y') }}</div>
        </td>
    </tr>
</table>

<div class="box" style="margin-top: 16px; font-size: 12px; line-height: 1.7">
    Reçu de <strong>{{ $payment->client->name }}</strong>
    la somme de <strong>{{ InvoicePdf::money($payment->amount) }} FCFA</strong>
    @if ($inWords)<br><span class="muted">({{ $inWords }})</span>@endif
    <br>en règlement de la facture <strong>{{ $payment->invoice->number }}</strong>,
    par <strong>{{ $payment->method->label() }}</strong>@if ($payment->reference) (réf. {{ $payment->reference }})@endif.
</div>

<table style="margin-top: 14px">
    <tr>
        <td>
            Reste à payer sur la facture : <strong>{{ InvoicePdf::money(max(0, $payment->invoice->balance())) }} FCFA</strong><br>
            <span class="muted">Encaissé par {{ $payment->receiver->name }}</span>
        </td>
        <td class="right">
            @if (! $payment->isCancelled() && $payment->invoice->balance() <= 0)<span class="stamp">FACTURE SOLDÉE</span>@endif
        </td>
    </tr>
</table>

<div class="footer">
    {{ $company->legal_name ?: $company->trade_name }}
    @if ($company->ninea) · NINEA {{ $company->ninea }}@endif
    @if ($company->rccm) · RCCM {{ $company->rccm }}@endif
</div>
</body>
</html>
