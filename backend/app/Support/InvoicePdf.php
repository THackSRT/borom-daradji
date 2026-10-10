<?php

namespace App\Support;

use App\Models\CompanySetting;
use App\Models\Invoice;
use App\Models\OwnerPayout;
use App\Models\Payment;
use App\Models\RentCall;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use NumberFormatter;

/**
 * PDF des factures, avoirs et reçus, depuis les modèles HTML de resources/views/pdf.
 */
final class InvoicePdf
{
    public static function invoice(Invoice $invoice): Response
    {
        $invoice->load(['client', 'property', 'lines', 'creditedInvoice']);
        $name = $invoice->number ?? 'brouillon-'.$invoice->id;

        return Pdf::loadView('pdf.invoice', [
            'invoice' => $invoice,
            ...self::common(),
            'inWords' => self::inWords($invoice->total),
        ])->setPaper('a4')->setOption('isFontSubsettingEnabled', true)->download("{$name}.pdf");
    }

    public static function receipt(Payment $payment): Response
    {
        $payment->load(['invoice', 'client', 'receiver']);

        return Pdf::loadView('pdf.receipt', [
            'payment' => $payment,
            ...self::common(),
            'inWords' => self::inWords($payment->amount),
        ])->setPaper('a5', 'landscape')->setOption('isFontSubsettingEnabled', true)->download("{$payment->number}.pdf");
    }

    /**
     * Quittance de loyer : le mois est entièrement payé.
     */
    public static function quittance(RentCall $call): Response
    {
        $call->load(['lease.property', 'lease.tenant', 'lease.owner', 'invoice.payments']);
        $month = $call->period->locale('fr')->translatedFormat('F Y');

        return Pdf::loadView('pdf.quittance', [
            'call' => $call,
            'month' => $month,
            ...self::common(),
            'inWords' => self::inWords($call->invoice->total),
        ])->setPaper('a5', 'landscape')->setOption('isFontSubsettingEnabled', true)
            ->download('quittance-'.$call->lease->reference.'-'.$call->period->format('Y-m').'.pdf');
    }

    /**
     * Relevé de gérance remis au propriétaire avec son reversement.
     */
    public static function ownerStatement(OwnerPayout $payout): Response
    {
        return Pdf::loadView('pdf.owner-statement', [
            'payout' => $payout,
            'month' => $payout->period->locale('fr')->translatedFormat('F Y'),
            ...self::common(),
        ])->setPaper('a4')->setOption('isFontSubsettingEnabled', true)->download("{$payout->number}.pdf");
    }

    /**
     * Montant en lettres (« Arrêtée la présente facture à la somme de… ») ; omis si l'extension intl manque.
     */
    public static function inWords(int $amount): ?string
    {
        if (! class_exists(NumberFormatter::class)) {
            return null;
        }

        $words = (new NumberFormatter('fr', NumberFormatter::SPELLOUT))->format($amount);

        return $words === false ? null : ucfirst($words).' francs CFA';
    }

    public static function money(int $amount): string
    {
        return number_format($amount, 0, ',', ' ');
    }

    /**
     * @return array<string, mixed>
     */
    private static function common(): array
    {
        $company = CompanySetting::current();

        return [
            'company' => $company,
            'logo' => self::logoDataUri($company),
            // Couleur principale de la charte choisie dans « Site internet ».
            'color' => SiteContent::for($company)['identity']['primary_color'],
        ];
    }

    /**
     * Le logo est intégré au PDF (pas d'accès réseau pendant la génération).
     */
    private static function logoDataUri(CompanySetting $company): ?string
    {
        if (! $company->logo_path || ! Storage::disk('public')->exists($company->logo_path)) {
            return null;
        }

        $mime = Storage::disk('public')->mimeType($company->logo_path);
        if (! in_array($mime, ['image/png', 'image/jpeg'], true)) {
            return null;
        }

        return 'data:'.$mime.';base64,'.base64_encode(Storage::disk('public')->get($company->logo_path));
    }
}
