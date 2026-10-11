<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ReportService;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Tableau de bord du dirigeant (« reports.view »).
 */
class ReportController extends Controller
{
    public function overview(Request $request, ReportService $reports): JsonResponse
    {
        abort_unless($request->user()->hasPermission('reports.view'), 403);
        [$from, $to] = self::period($request);
        $preset = $request->filled('from') ? null : $request->query('period', 'mois');

        return response()->json(['data' => $reports->overview($from, $to, $preset)]);
    }

    /**
     * Période demandée : `period` (mois, mois_precedent, trimestre, annee) ou `from`/`to`. Par défaut, le
     * mois en cours jusqu'à aujourd'hui.
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    public static function period(Request $request): array
    {
        $data = $request->validate([
            'period' => ['nullable', Rule::in(['mois', 'mois_precedent', 'trimestre', 'annee', 'annee_precedente'])],
            'from' => ['nullable', 'date', 'required_with:to'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ], [], ['from' => 'date de début', 'to' => 'date de fin']);
        $today = CarbonImmutable::today();
        if (! empty($data['from'])) {
            return [CarbonImmutable::parse($data['from']), CarbonImmutable::parse($data['to'] ?? $today)];
        }

        return match ($data['period'] ?? 'mois') {
            'mois_precedent' => [$today->subMonthNoOverflow()->startOfMonth(), $today->subMonthNoOverflow()->endOfMonth()->startOfDay()],
            'trimestre' => [$today->startOfQuarter(), $today],
            'annee' => [$today->startOfYear(), $today],
            'annee_precedente' => [$today->subYear()->startOfYear(), $today->subYear()->endOfYear()->startOfDay()],
            default => [$today->startOfMonth(), $today],
        };
    }
}
