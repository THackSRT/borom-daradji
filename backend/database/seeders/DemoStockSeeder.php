<?php

namespace Database\Seeders;

use App\Enums\ClientCategory;
use App\Enums\Role;
use App\Models\Article;
use App\Models\ArticleCategory;
use App\Models\Client;
use App\Models\User;
use App\Models\Worksite;
use App\Services\CounterSale;
use App\Services\PurchaseService;
use App\Services\StockOperations;
use Illuminate\Database\Seeder;

/**
 * Stock de démonstration : fournisseurs, articles de chaque catégorie, trois achats (un payé, un en
 * partie, un à payer), sorties vers le chantier de Ngor, une vente au comptoir, une perte, un article
 * sous le seuil d'alerte.
 */
class DemoStockSeeder extends Seeder
{
    /** [catégorie, désignation, unité, prix de vente HT, seuil, emplacement] — prix indicatifs. */
    private const ARTICLES = [
        ['CIM-425', 'Ciment Gros CEM II 42,5 (sac 50 kg)', 'Ciment et liants', 'sac', 5_200, 40, 'Magasin, allée 1'],
        ['CIM-325', 'Ciment CEM II 32,5 (sac 50 kg)', 'Ciment et liants', 'sac', 4_900, 20, 'Magasin, allée 1'],
        ['FER-08', 'Fer à béton HA 8 (barre 12 m)', 'Fers et aciers', 'barre', 2_600, 50, 'Cour, râtelier'],
        ['FER-10', 'Fer à béton HA 10 (barre 12 m)', 'Fers et aciers', 'barre', 4_000, 50, 'Cour, râtelier'],
        ['FER-12', 'Fer à béton HA 12 (barre 12 m)', 'Fers et aciers', 'barre', 5_800, 30, 'Cour, râtelier'],
        ['SAB-MER', 'Sable de mer lavé', 'Agrégats (sable, gravier)', 'm³', 14_000, 5, 'Cour'],
        ['GRA-3/8', 'Gravier 3/8 concassé', 'Agrégats (sable, gravier)', 'm³', 22_000, 5, 'Cour'],
        ['AGG-15', 'Agglos creux 15 × 20 × 40', 'Briques et agglos', 'u', 450, 200, 'Cour'],
        ['TUY-PVC100', 'Tuyau PVC évacuation Ø 100 (4 m)', 'Plomberie', 'u', 6_500, 10, 'Magasin, allée 2'],
        ['CAB-2.5', 'Câble électrique 2,5 mm² (rouleau 100 m)', 'Électricité', 'rouleau', 32_000, 3, 'Magasin, allée 3'],
        ['CAR-6060', 'Carreau grès cérame 60 × 60 (carton 1,44 m²)', 'Carrelage et revêtements', 'carton', 11_500, 20, 'Magasin, fond'],
        ['PEI-VIN20', 'Peinture vinylique blanche (seau 20 kg)', 'Peinture', 'pot', 18_000, 6, 'Magasin, allée 2'],
        ['FIL-REC', 'Fil à ligaturer recuit (rouleau 25 kg)', 'Quincaillerie et outillage', 'rouleau', 21_000, 2, 'Magasin, allée 3'],
    ];

    public function run(): void
    {
        $keeper = User::withRole(Role::ResponsableTravaux)->firstOrFail();
        $comptable = User::withRole(Role::Comptable)->firstOrFail();
        $sococim = Client::create(['name' => 'Sococim Distribution Rufisque', 'kind' => 'entreprise', 'phone' => '+221338390101', 'categories' => [ClientCategory::Fournisseur], 'city' => 'Rufisque']);
        $sandaga = Client::create(['name' => 'Quincaillerie Touba Sandaga', 'kind' => 'entreprise', 'phone' => '+221338221212', 'categories' => [ClientCategory::Fournisseur], 'city' => 'Dakar']);
        $mbao = Client::create(['name' => 'Sablière de Mbao', 'kind' => 'entreprise', 'phone' => '+221776001234', 'categories' => [ClientCategory::Fournisseur], 'city' => 'Mbao']);

        $articles = [];
        foreach (self::ARTICLES as [$ref, $name, $category, $unit, $price, $min, $location]) {
            $articles[$ref] = Article::create([
                'reference' => $ref, 'name' => $name, 'unit' => $unit, 'sale_price' => $price, 'vat_rate' => 18, 'min_quantity' => $min,
                'max_quantity' => $min * 5, 'location' => $location, 'created_by' => $keeper->id,
                'article_category_id' => ArticleCategory::where('name', $category)->value('id'),
            ]);
        }
        $id = fn (string $ref) => $articles[$ref]->id;

        $purchases = app(PurchaseService::class);
        $first = $purchases->record(['supplier_id' => $sococim->id, 'supplier_reference' => 'BL-SOC-45871', 'received_on' => today()->subDays(20)->toDateString()], [
            ['article_id' => $id('CIM-425'), 'quantity' => 200, 'unit_cost' => 4_350],
            ['article_id' => $id('CIM-325'), 'quantity' => 80, 'unit_cost' => 4_050],
        ], $comptable);
        $purchases->pay($first, ['amount' => $first->total, 'method' => 'virement', 'reference' => 'VIR-CBAO-0921', 'paid_on' => today()->subDays(18)->toDateString()], $comptable);

        $second = $purchases->record(['supplier_id' => $sandaga->id, 'supplier_reference' => 'FAC-TS-1180', 'received_on' => today()->subDays(15)->toDateString()], [
            ['article_id' => $id('FER-08'), 'quantity' => 150, 'unit_cost' => 2_100],
            ['article_id' => $id('FER-10'), 'quantity' => 200, 'unit_cost' => 3_300],
            ['article_id' => $id('FER-12'), 'quantity' => 80, 'unit_cost' => 4_800],
            ['article_id' => $id('FIL-REC'), 'quantity' => 4, 'unit_cost' => 17_500],
            ['article_id' => $id('TUY-PVC100'), 'quantity' => 30, 'unit_cost' => 5_000],
            ['article_id' => $id('CAB-2.5'), 'quantity' => 6, 'unit_cost' => 26_000],
            ['article_id' => $id('PEI-VIN20'), 'quantity' => 15, 'unit_cost' => 14_500],
            ['article_id' => $id('CAR-6060'), 'quantity' => 60, 'unit_cost' => 9_000],
            ['article_id' => $id('AGG-15'), 'quantity' => 1_000, 'unit_cost' => 340],
        ], $comptable);
        $purchases->pay($second, ['amount' => 1_000_000, 'method' => 'wave', 'reference' => 'WV-TS-77812', 'paid_on' => today()->subDays(14)->toDateString()], $comptable);

        $purchases->record(['supplier_id' => $mbao->id, 'supplier_reference' => 'BON-118', 'received_on' => today()->subDays(6)->toDateString(), 'due_date' => today()->subDay()->toDateString()], [
            ['article_id' => $id('SAB-MER'), 'quantity' => 24, 'unit_cost' => 10_500],
            ['article_id' => $id('GRA-3/8'), 'quantity' => 12, 'unit_cost' => 17_000],
        ], $comptable);
        // Un second arrivage de ciment, plus cher : le coût moyen bouge.
        $purchases->record(['supplier_id' => $sococim->id, 'supplier_reference' => 'BL-SOC-46102', 'received_on' => today()->subDays(4)->toDateString()], [
            ['article_id' => $id('CIM-425'), 'quantity' => 100, 'unit_cost' => 4_550],
        ], $comptable);

        // Matériaux partis sur le chantier de Ngor (bons de sortie), un retour.
        $site = Worksite::query()->where('reference', 'like', 'CH-%-0001')->first();
        if ($site) {
            $ops = app(StockOperations::class);
            $ops->toWorksite($site, [
                ['article_id' => $id('CIM-425'), 'quantity' => 120],
                ['article_id' => $id('FER-10'), 'quantity' => 90],
                ['article_id' => $id('FER-12'), 'quantity' => 40],
                ['article_id' => $id('FIL-REC'), 'quantity' => 2],
                ['article_id' => $id('AGG-15'), 'quantity' => 600],
            ], today()->subDays(12)->toDateString(), 'Gros œuvre de l\'extension', $keeper);
            $ops->toWorksite($site, [
                ['article_id' => $id('SAB-MER'), 'quantity' => 10],
                ['article_id' => $id('GRA-3/8'), 'quantity' => 6],
                ['article_id' => $id('CIM-425'), 'quantity' => 60],
            ], today()->subDays(5)->toDateString(), 'Dalle de l\'étage', $keeper);
            $ops->returnFromWorksite($site, $articles['FER-10']->fresh(), 8, 'Barres en trop', $keeper);
        }

        // Une vente au comptoir encaissée en espèces, une perte.
        $buyer = Client::create(['name' => 'Entreprise Diallo BTP', 'kind' => 'entreprise', 'phone' => '+221775554433', 'categories' => [], 'source' => 'agence']);
        app(CounterSale::class)->sell($buyer, [
            ['article_id' => $id('CIM-425'), 'quantity' => 25],
            ['article_id' => $id('FER-08'), 'quantity' => 40, 'unit_price' => 2_500],
        ], ['method' => 'especes', 'amount' => 200_000], 'Vente au comptoir', $comptable);
        app(StockOperations::class)->loss($articles['CIM-325']->fresh(), 3, 'Sacs mouillés par la pluie', today()->subDays(2)->toDateString(), $keeper);
        // Câble : presque épuisé (sous le seuil, tâche de réapprovisionnement).
        app(StockOperations::class)->loss($articles['CAB-2.5']->fresh(), 4, 'Rouleaux pris pour l\'éclairage du dépôt', today()->subDay()->toDateString(), $keeper);
    }
}
