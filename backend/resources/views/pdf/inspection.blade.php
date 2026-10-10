@php use App\Support\PhoneNumber; $lease = $inspection->lease; $exit = $inspection->type->value === 'sortie'; @endphp
<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><title>{{ $inspection->type->label() }} {{ $lease->reference }}</title>@include('pdf._styles')
<style>
    .room td { background: #f3f4f6; font-weight: bold; padding: 5px 6px; }
    .degraded { color: #b91c1c; font-weight: bold; }
    .sign td { height: 70px; vertical-align: top; border: 1px solid #d1d5db; padding: 6px; width: 50%; }
</style>
</head>
<body>
@unless ($inspection->isValidated())<div class="draft">BROUILLON</div>@endunless
<table class="header">
    <tr>
        @include('pdf._company')
        <td class="right">
            <div class="doc-title">ÉTAT DES LIEUX</div>
            <div style="font-size: 12px; font-weight: bold">{{ $exit ? 'DE SORTIE' : 'D\'ENTRÉE' }}</div>
            <div style="margin-top: 6px">Bail {{ $lease->reference }}<br>Le {{ $inspection->inspected_on->format('d/m/Y') }}</div>
        </td>
    </tr>
</table>

<table style="margin-top: 12px">
    <tr>
        <td class="box" style="width: 50%">
            <span class="muted" style="font-size: 9px">LOGEMENT</span><br>
            <strong>{{ $lease->property->title }}</strong><br>
            {{ $lease->property->reference }}@if ($lease->property->neighborhood) · {{ $lease->property->neighborhood }}@endif, {{ $lease->property->city }}
            @if ($lease->owner)<br>Propriétaire : {{ $lease->owner->name }}@endif
        </td>
        <td style="width: 2%"></td>
        <td class="box">
            <span class="muted" style="font-size: 9px">LOCATAIRE</span><br>
            <strong>{{ $lease->tenant->name }}</strong><br>
            @if ($lease->tenant->phone)Tél. {{ PhoneNumber::format($lease->tenant->phone) }}<br>@endif
            {{ $inspection->tenant_present ? 'Présent' : 'Absent' }} lors de l'état des lieux
        </td>
    </tr>
</table>

<table class="totals" style="margin-top: 8px">
    <tr>
        <td>Compteur d'électricité : <strong>{{ $inspection->electricity_meter ?: '—' }}</strong></td>
        <td>Compteur d'eau : <strong>{{ $inspection->water_meter ?: '—' }}</strong></td>
        <td>Clés remises : <strong>{{ $inspection->keys_count ?? '—' }}</strong></td>
        <td class="right">Fait par : <strong>{{ $inspection->inspector?->name ?? '—' }}</strong></td>
    </tr>
</table>

<table class="lines" style="margin-top: 10px">
    <thead>
        <tr>
            <th style="width: 30%">Élément</th>
            @if ($exit)<th style="width: 15%">À l'entrée</th>@endif
            <th style="width: 17%">État</th>
            <th>Observations</th>
        </tr>
    </thead>
    <tbody>
        @foreach ($rooms as $room => $items)
            <tr class="room"><td colspan="{{ $exit ? 4 : 3 }}">{{ $room }}</td></tr>
            @foreach ($items as $item)
                @php $cmp = $comparison[$item->id] ?? null; $photos = $photoCounts[$item->id] ?? 0; @endphp
                <tr>
                    <td>{{ $item->element }}</td>
                    @if ($exit)<td class="muted">{{ $cmp['entry_condition']?->label() ?? '—' }}</td>@endif
                    <td class="{{ ($cmp['degraded'] ?? false) ? 'degraded' : '' }}">{{ $item->condition?->label() ?? '—' }}</td>
                    <td>{{ $item->comment }}@if ($photos)<span class="muted">{{ $item->comment ? ' · ' : '' }}{{ $photos }} photo{{ $photos > 1 ? 's' : '' }}</span>@endif</td>
                </tr>
            @endforeach
        @endforeach
    </tbody>
</table>

@if ($inspection->general_comment)
    <div class="box" style="margin-top: 10px"><span class="muted" style="font-size: 9px">OBSERVATIONS GÉNÉRALES</span><br>{!! nl2br(e($inspection->general_comment)) !!}</div>
@endif

<p class="muted" style="margin-top: 8px; font-size: 9px">
    {{ $inspection->photos->count() }} photo(s) prise(s), conservées par l'agence.
    @if ($exit) Les éléments en rouge sont dégradés par rapport à l'entrée, au-delà de l'usure normale. @endif
    Établi contradictoirement en deux exemplaires.
</p>

<table class="sign" style="margin-top: 10px">
    <tr>
        <td>Pour l'agence ({{ $inspection->inspector?->name ?? $company->trade_name }})<br><span class="muted">Signature</span></td>
        <td>Le locataire ({{ $lease->tenant->name }})<br><span class="muted">« Lu et approuvé », signature</span></td>
    </tr>
</table>

<div class="footer">
    {{ $company->legal_name ?: $company->trade_name }} · Fait à {{ $company->city ?? 'Dakar' }}, le {{ $inspection->inspected_on->format('d/m/Y') }}
    @if ($inspection->isValidated()) · Validé le {{ $inspection->validated_at->format('d/m/Y') }}@endif
</div>
</body>
</html>
