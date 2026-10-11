<td style="width: 55%">
    @if ($logo)
        <img src="{{ $logo }}" style="max-height: 60px; max-width: 180px; margin-bottom: 6px"><br>
    @endif
    <span class="brand">{{ $company->trade_name }}</span><br>
    @if ($company->legal_name && $company->legal_name !== $company->trade_name)<span class="muted">{{ $company->legal_name }}</span><br>@endif
    @if ($company->address){{ $company->address }}<br>@endif
    {{ $company->city ?? 'Dakar' }}, Sénégal<br>
    @if ($company->phone)Tél. {{ \App\Support\PhoneNumber::format($company->phone) }}@endif
    @if ($company->email) · {{ $company->email }}@endif
</td>
