<?php

namespace Database\Seeders;

use App\Enums\ClientCategory;
use App\Enums\Role;
use App\Enums\WorksiteStatus;
use App\Models\CatalogItem;
use App\Models\Client;
use App\Models\Quote;
use App\Models\Trade;
use App\Models\User;
use App\Models\Worker;
use App\Models\Worksite;
use App\Services\Billing;
use App\Services\QuoteService;
use App\Services\SiteCash;
use App\Services\WorksBilling;
use App\Services\WorksiteService;
use App\Services\WorksiteTeam;
use Illuminate\Database\Seeder;

/**
 * Travaux de démonstration : catalogue, un modèle de devis, des devis à chaque étape et un chantier
 * en cours (lots, avancement, journal, lien de suivi, tâcherons, pointage, caisse de chantier).
 */
class DemoWorksSeeder extends Seeder
{
    /** Prix indicatifs (francs CFA HT), à remplacer par ceux de l'agence. */
    private const CATALOG = [
        'Maçonnerie et gros œuvre' => [['Mur en agglos de 15', 'm²', 9_000], ['Mur en agglos de 20', 'm²', 11_000], ['Enduit ciment intérieur', 'm²', 3_500], ['Chape de ragréage', 'm²', 4_000]],
        'Béton armé et ferraillage' => [['Dalle pleine en béton armé', 'm²', 25_000], ['Chaînage en béton armé', 'ml', 8_000]],
        'Plomberie sanitaire' => [['Fourniture et pose d\'un WC complet', 'u', 85_000], ['Fourniture et pose d\'un lavabo', 'u', 45_000], ['Création d\'un point d\'eau', 'u', 25_000], ['Douche à l\'italienne', 'forfait', 250_000]],
        'Électricité' => [['Point lumineux', 'u', 15_000], ['Prise de courant', 'u', 12_000], ['Tableau électrique 12 modules', 'u', 150_000]],
        'Carrelage et revêtements' => [['Pose de carrelage au sol', 'm²', 6_500], ['Pose de faïence murale', 'm²', 7_500], ['Plinthes carrelées', 'ml', 2_000]],
        'Peinture et décoration' => [['Peinture intérieure, deux couches', 'm²', 2_500], ['Peinture de façade', 'm²', 3_500]],
        'Menuiserie aluminium et ferronnerie' => [['Fenêtre coulissante en aluminium', 'u', 120_000], ['Porte métallique', 'u', 180_000]],
        'Climatisation et ventilation' => [['Pose d\'un split 12 000 BTU', 'u', 60_000]],
        'Étanchéité' => [['Étanchéité de toiture terrasse', 'm²', 9_000]],
    ];

    public function run(): void
    {
        $manager = User::withRole(Role::ResponsableTravaux)->firstOrFail();
        $quotes = app(QuoteService::class);
        $worksites = app(WorksiteService::class);

        $items = [];
        foreach (self::CATALOG as $tradeName => $lines) {
            $trade = Trade::where('name', $tradeName)->firstOrFail();
            foreach ($lines as [$designation, $unit, $price]) {
                $items[$designation] = CatalogItem::create(['trade_id' => $trade->id, 'designation' => $designation, 'unit' => $unit, 'unit_price' => $price]);
            }
        }
        $line = fn (string $designation, float $quantity) => [
            'catalog_item_id' => $items[$designation]->id, 'designation' => $designation, 'unit' => $items[$designation]->unit,
            'quantity' => $quantity, 'unit_price' => $items[$designation]->unit_price, 'vat_rate' => 18,
        ];
        $trade = fn (string $name) => Trade::where('name', $name)->value('id');
        $bathroom = [
            ['title' => 'Plomberie', 'trade_id' => $trade('Plomberie sanitaire'), 'lines' => [$line('Fourniture et pose d\'un WC complet', 1), $line('Fourniture et pose d\'un lavabo', 1), $line('Douche à l\'italienne', 1)]],
            ['title' => 'Carrelage', 'trade_id' => $trade('Carrelage et revêtements'), 'lines' => [$line('Pose de carrelage au sol', 8), $line('Pose de faïence murale', 22)]],
            ['title' => 'Électricité', 'trade_id' => $trade('Électricité'), 'lines' => [$line('Point lumineux', 2), $line('Prise de courant', 2)]],
        ];
        $base = ['deposit_rate' => 30, 'conditions' => config('borom.quote_conditions')];

        $quotes->save(new Quote([...$base, 'is_template' => true, 'template_name' => 'Salle de bain standard', 'title' => 'Rénovation d\'une salle de bain']), [], $bathroom, $manager);

        $abdou = Client::create(['name' => 'Abdou Karim Ndiaye', 'phone' => '+221776402118', 'categories' => [ClientCategory::ClientTravaux], 'assigned_user_id' => $manager->id]);
        $mariama = Client::create(['name' => 'Mariama Sy (Paris)', 'phone' => '+33612345678', 'whatsapp' => '+33612345678', 'categories' => [ClientCategory::ClientTravaux], 'assigned_user_id' => $manager->id]);
        $khadim = Client::create(['name' => 'Khadim Guèye', 'phone' => '+221705551234', 'categories' => [ClientCategory::ClientTravaux]]);

        // Chantier en cours pour une cliente de la diaspora : extension de villa à Ngor.
        $extension = $quotes->save(new Quote([...$base, 'client_id' => $mariama->id, 'title' => 'Extension de villa (chambre et salle de bain)', 'site_address' => 'Ngor Almadies, près de la mosquée']), [], [
            ['title' => 'Gros œuvre', 'trade_id' => $trade('Maçonnerie et gros œuvre'), 'lines' => [$line('Mur en agglos de 15', 65), $line('Enduit ciment intérieur', 120)]],
            ['title' => 'Dalle', 'trade_id' => $trade('Béton armé et ferraillage'), 'lines' => [$line('Dalle pleine en béton armé', 24), $line('Chaînage en béton armé', 36)]],
            ...$bathroom,
            ['title' => 'Finitions', 'trade_id' => $trade('Peinture et décoration'), 'lines' => [$line('Peinture intérieure, deux couches', 140), $line('Fenêtre coulissante en aluminium', 2)]],
        ], $manager);
        $quotes->send($extension);
        $quotes->accept($extension, $manager);
        $site = $extension->fresh()->worksite;
        $site->update([
            'manager_id' => $manager->id, 'start_date' => today()->subWeeks(3), 'planned_end_date' => today()->addWeeks(5),
            'latitude' => 14.7473, 'longitude' => -17.5129,
            'budget_materials' => 2_100_000, 'budget_labor' => 900_000, 'budget_other' => 150_000,
        ]);
        $worksites->transition($site, WorksiteStatus::EnCours, $manager);
        $site->forceFill(['start_date' => today()->subWeeks(3)])->save();
        foreach ([100, 100, 40, 20, 0, 0] as $i => $progress) {
            $lot = $site->lots()->orderBy('position')->skip($i)->first();
            if ($lot && $progress > 0) {
                $worksites->setProgress($lot, $progress, $manager);
            }
        }
        $worksites->log($site, 'Dalle coulée, décoffrage prévu dans 21 jours.', $manager, 'note', true, today()->subDays(9)->toDateString());
        $worksites->log($site, 'Livraison de 60 sacs de ciment et 2 voyages de sable.', $manager, 'note', false, today()->subDays(4)->toDateString());
        $worksites->enableTracking($site);

        // Acompte de 30 % payé depuis Paris par virement, première situation émise, pas encore réglée.
        $comptable = User::withRole(Role::Comptable)->firstOrFail();
        $billing = app(WorksBilling::class);
        $deposit = Billing::issue($billing->create($site->fresh(), 'acompte', $comptable), $comptable);
        Billing::recordPayment($deposit, ['method' => 'virement', 'amount' => $deposit->total, 'reference' => 'VIR-SY-ACOMPTE', 'paid_on' => today()->subWeeks(3)->toDateString()], $comptable);
        Billing::issue($billing->create($site->fresh(), 'situation', $comptable), $comptable);

        $this->team($site, $manager, $comptable);

        // Devis envoyé, en attente de réponse.
        $roof = $quotes->save(new Quote([...$base, 'client_id' => $abdou->id, 'title' => 'Étanchéité de la terrasse et peinture de façade', 'site_address' => 'Liberté 6 extension']), [], [
            ['title' => 'Étanchéité', 'trade_id' => $trade('Étanchéité'), 'lines' => [$line('Étanchéité de toiture terrasse', 110)]],
            ['title' => 'Peinture', 'trade_id' => $trade('Peinture et décoration'), 'lines' => [$line('Peinture de façade', 180)]],
        ], $manager);
        $quotes->send($roof);

        // Brouillon en préparation, et devis refusé.
        $quotes->save(new Quote([...$base, 'client_id' => $khadim->id, 'title' => 'Climatisation de trois chambres']), [], [
            ['title' => 'Climatisation', 'trade_id' => $trade('Climatisation et ventilation'), 'lines' => [$line('Pose d\'un split 12 000 BTU', 3)]],
        ], $manager);
        $refused = $quotes->duplicate(Quote::templates()->firstOrFail(), ['client_id' => $abdou->id, 'title' => 'Salle de bain de l\'étage'], $manager);
        $quotes->send($refused);
        $quotes->refuse($refused, 'Projet reporté à l\'année prochaine');
    }

    /**
     * Équipe et argent du chantier en cours : deux semaines de pointage, des travaux à la tâche, des
     * avances et paiements, la caisse du chef de chantier (approvisionnements, dépenses).
     */
    private function team(Worksite $site, User $manager, User $comptable): void
    {
        $worker = fn (string $name, string $phone, string $trade, string $type, int $rate) => Worker::create([
            'name' => $name, 'phone' => $phone, 'trade_id' => $trade ? $this->tradeId($trade) : null, 'pay_type' => $type, 'daily_rate' => $rate, 'created_by' => $manager->id,
        ]);
        $chief = $worker('Ousmane Diallo', '+221771234501', 'Maçonnerie et gros œuvre', 'journalier', 10_000);
        $mason = $worker('Lamine Faye', '+221771234502', 'Maçonnerie et gros œuvre', 'journalier', 7_000);
        $helper1 = $worker('Babacar Ndour', '+221771234503', '', 'journalier', 5_000);
        $helper2 = $worker('Cheikh Mbaye', '+221771234504', '', 'journalier', 5_000);
        $steel = $worker('Aliou Cissé', '+221771234505', 'Béton armé et ferraillage', 'tache', 0);
        $tiler = $worker('Pape Sow', '+221771234506', 'Carrelage et revêtements', 'tache', 0);
        $worker('Mamadou Kane', '+221771234507', 'Électricité', 'tache', 0);

        $team = app(WorksiteTeam::class);
        $cash = app(SiteCash::class);

        // Deux semaines de pointage (pas le dimanche), demi-journée de temps en temps.
        for ($d = 13; $d >= 0; $d--) {
            $day = today()->subDays($d);
            if ($day->isSunday()) {
                continue;
            }
            $entries = [['worker_id' => $chief->id, 'days' => 1.0], ['worker_id' => $mason->id, 'days' => $d % 5 === 0 ? 0.5 : 1.0], ['worker_id' => $helper1->id, 'days' => 1.0]];
            if ($d % 3 !== 0) {
                $entries[] = ['worker_id' => $helper2->id, 'days' => 1.0];
            }
            $team->recordAttendance($site, $day->toDateString(), $entries, $manager);
        }

        $ferraillage = $team->createTask($site, ['worker_id' => $steel->id, 'description' => 'Ferraillage de la dalle de l\'étage', 'amount' => 350_000], $manager);
        $team->completeTask($ferraillage, today()->subDays(9)->toDateString());
        $team->createTask($site, ['worker_id' => $tiler->id, 'description' => 'Carrelage des deux chambres (48 m²)', 'amount' => 240_000], $manager);

        // Caisse du chef de chantier.
        $cash->supply($site, ['amount' => 500_000, 'spent_on' => today()->subDays(13)->toDateString(), 'label' => 'Avance de démarrage'], $comptable);
        $cash->supply($site, ['amount' => 400_000, 'spent_on' => today()->subDays(6)->toDateString(), 'label' => 'Avance de la semaine'], $comptable);
        foreach ([
            [12, 'materiaux', 180_000, '36 sacs de ciment'],
            [12, 'transport', 25_000, 'Charrette et camion pour le sable'],
            [10, 'materiaux', 150_000, '2 voyages de sable de mer lavé'],
            [8, 'outillage', 60_000, 'Location bétonnière, une semaine'],
            [5, 'materiaux', 120_000, '24 sacs de ciment'],
            [3, 'divers', 15_000, 'Eau pour le gâchage'],
            [1, 'transport', 20_000, 'Livraison des carreaux'],
        ] as [$ago, $category, $amount, $label]) {
            $cash->spend($site, ['category' => $category, 'amount' => $amount, 'label' => $label, 'spent_on' => today()->subDays($ago)->toDateString()], null, $manager);
        }

        // Avances et paiements : manœuvres payés chaque samedi avec la caisse, ferrailleur par Wave.
        $team->pay($chief, ['kind' => 'avance', 'amount' => 30_000, 'method' => 'especes', 'worksite_id' => $site->id, 'from_site_cash' => true, 'paid_on' => today()->subDays(11)->toDateString()], $manager);
        foreach ([$helper1, $helper2] as $helper) {
            $team->pay($helper, ['kind' => 'paiement', 'amount' => 25_000, 'method' => 'especes', 'worksite_id' => $site->id, 'from_site_cash' => true, 'paid_on' => today()->subDays(7)->toDateString()], $manager);
        }
        $team->pay($steel, ['kind' => 'paiement', 'amount' => 350_000, 'method' => 'wave', 'reference' => 'WV-88213456', 'worksite_id' => $site->id, 'paid_on' => today()->subDays(8)->toDateString()], $comptable);
        $team->pay($tiler, ['kind' => 'avance', 'amount' => 50_000, 'method' => 'orange_money', 'reference' => 'OM-5521987', 'worksite_id' => $site->id, 'paid_on' => today()->subDays(2)->toDateString()], $comptable);
    }

    private function tradeId(string $name): ?int
    {
        return Trade::where('name', $name)->value('id');
    }
}
