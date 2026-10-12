<?php

namespace App\Enums;

use App\Enums\Concerns\HasOptions;

/**
 * Nature d'un mouvement de stock. Le signe de la quantité suit la nature (entrée ou sortie), sauf pour
 * les ajustements et les écarts d'inventaire, dans les deux sens.
 */
enum StockMovementType: string
{
    use HasOptions;

    case Achat = 'achat';
    case AnnulationAchat = 'annulation_achat';
    case SortieChantier = 'sortie_chantier';
    case RetourChantier = 'retour_chantier';
    case Vente = 'vente';
    case RetourVente = 'retour_vente';
    case Perte = 'perte';
    case Ajustement = 'ajustement';
    case Inventaire = 'inventaire';

    public function label(): string
    {
        return match ($this) {
            self::Achat => 'Entrée (achat fournisseur)',
            self::AnnulationAchat => 'Annulation d\'un achat',
            self::SortieChantier => 'Sortie vers un chantier',
            self::RetourChantier => 'Retour d\'un chantier',
            self::Vente => 'Vente au comptoir',
            self::RetourVente => 'Retour d\'une vente',
            self::Perte => 'Perte ou casse',
            self::Ajustement => 'Ajustement',
            self::Inventaire => 'Écart d\'inventaire',
        };
    }
}
