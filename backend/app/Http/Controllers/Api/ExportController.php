<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AccountingExport;
use App\Support\AccountingAccounts;
use App\Support\ActivityLogger;
use App\Support\Spreadsheet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Exports comptables Excel (« reports.export ») et numéros de compte utilisés.
 */
class ExportController extends Controller
{
    public const TYPES = [
        'ventes' => 'Journal des ventes',
        'encaissements' => 'Journal des encaissements',
        'achats' => 'Journal des achats',
        'balance-clients' => 'Balance clients',
        'balance-fournisseurs' => 'Balance fournisseurs',
    ];

    public function download(Request $request, string $type, AccountingExport $export): BinaryFileResponse
    {
        abort_unless($request->user()->hasPermission('reports.export'), 403);
        abort_unless(isset(self::TYPES[$type]), 404);
        [$from, $to] = ReportController::period($request);

        $sheets = match ($type) {
            'ventes' => $export->sales($from, $to),
            'encaissements' => $export->collections($from, $to),
            'achats' => $export->purchases($from, $to),
            'balance-clients' => $export->clientBalance($to),
            'balance-fournisseurs' => $export->supplierBalance($to),
        };
        $suffix = str_starts_with($type, 'balance') ? 'au-'.$to->format('Y-m-d') : $from->format('Y-m-d').'-au-'.$to->format('Y-m-d');
        ActivityLogger::log('exported', null, self::TYPES[$type].' ('.$from->format('d/m/Y').' – '.$to->format('d/m/Y').')');

        return Spreadsheet::download("{$type}-{$suffix}.xlsx", $sheets);
    }

    public function accounts(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasPermission('reports.export', 'settings.manage'), 403);

        return response()->json(['data' => ['accounts' => AccountingAccounts::current(), 'defaults' => config('borom.accounting'), 'types' => self::TYPES]]);
    }

    public function updateAccounts(Request $request): JsonResponse
    {
        abort_unless($request->user()->hasPermission('reports.export', 'settings.manage'), 403);
        $account = ['required', 'string', 'max:20', 'regex:/^[0-9A-Za-z]+$/'];
        $data = $request->validate([
            'journals.sales' => ['required', 'string', 'max:10'],
            'journals.purchases' => ['required', 'string', 'max:10'],
            'journals.treasury' => ['required', 'string', 'max:10'],
            'clients' => $account,
            'client_prefix' => ['nullable', 'string', 'max:10'],
            'suppliers' => $account,
            'supplier_prefix' => ['nullable', 'string', 'max:10'],
            'sales.*' => $account,
            'vat_collected' => $account,
            'vat_deductible' => $account,
            'purchases' => $account,
            'treasury.*' => $account,
        ], ['regex' => 'Un numéro de compte ne contient que des chiffres et des lettres.'], ['clients' => 'compte clients', 'suppliers' => 'compte fournisseurs']);
        $data['client_prefix'] ??= '';
        $data['supplier_prefix'] ??= '';
        AccountingAccounts::save($data);
        ActivityLogger::log('accounting_updated', null, 'Numéros de compte des exports comptables modifiés');

        return response()->json(['data' => ['accounts' => AccountingAccounts::current(), 'defaults' => config('borom.accounting'), 'types' => self::TYPES]]);
    }
}
