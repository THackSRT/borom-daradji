<?php

return [

    /*
    | Durée de conservation du journal d'activité, en jours (1 an par défaut).
    */
    'activity_retention_days' => (int) env('ACTIVITY_RETENTION_DAYS', 365),

    /*
    | Ancienneté maximale de l'état des droits réels pour publier un bien, en jours.
    | Valeur par défaut à valider avec le dirigeant.
    */
    'land_check_max_age_days' => (int) env('LAND_CHECK_MAX_AGE_DAYS', 90),

    /*
    | Rapprochement biens-prospects : tolérance sur le budget (0.10 = ±10 %).
    */
    'matching_budget_tolerance' => (float) env('MATCHING_BUDGET_TOLERANCE', 0.10),

    /*
    | Nombre maximal de photos par bien.
    */
    'max_photos_per_property' => 20,

    /*
    | Mandats : nombre de jours avant expiration pour prévenir l'agent.
    */
    'mandate_alert_days' => 7,

    /*
    | Factures : délai de paiement par défaut, en jours après la date d'émission. À valider.
    */
    'invoice_due_days' => (int) env('INVOICE_DUE_DAYS', 15),

    /*
    | Gestion locative : valeurs par défaut proposées à la création d'un bail, toutes modifiables
    | bail par bail. À valider avec le dirigeant (questions ouvertes du journal).
    */
    'rent_due_day' => (int) env('RENT_DUE_DAY', 5),
    'rent_vat_rate' => (float) env('RENT_VAT_RATE', 0),
    'management_commission_rate' => (float) env('MANAGEMENT_COMMISSION_RATE', 10),
    // TVA sur la commission de gestion (prestation de l'agence).
    'management_fee_vat_rate' => (float) env('MANAGEMENT_FEE_VAT_RATE', 18),
    // Appels de loyer émis automatiquement (sinon laissés en brouillon pour le comptable).
    'rent_calls_auto_issue' => (bool) env('RENT_CALLS_AUTO_ISSUE', true),

    /*
    | États des lieux : pièces et éléments proposés pour un nouvel état des lieux d'entrée (la sortie
    | reprend les lignes de l'entrée). « {n} » : une pièce par chambre ou salle de bain du bien.
    | Lignes modifiables état des lieux par état des lieux. À valider avec l'agence.
    */
    'inspection_template' => [
        ['room' => 'Entrée et séjour', 'elements' => ['Porte d\'entrée et serrure', 'Murs et peinture', 'Sol', 'Plafond', 'Fenêtres et vitres', 'Prises et interrupteurs', 'Éclairage']],
        ['room' => 'Cuisine', 'elements' => ['Murs et carrelage', 'Sol', 'Évier et robinetterie', 'Plan de travail et placards', 'Prises et interrupteurs', 'Fenêtre']],
        ['room' => 'Chambre {n}', 'per' => 'bedrooms', 'elements' => ['Porte et serrure', 'Murs et peinture', 'Sol', 'Fenêtres et vitres', 'Placard', 'Prises et interrupteurs', 'Climatiseur']],
        ['room' => 'Salle de bain {n}', 'per' => 'bathrooms', 'elements' => ['Murs et carrelage', 'Sol', 'Lavabo et robinetterie', 'Douche ou baignoire', 'WC', 'Chauffe-eau']],
        ['room' => 'Extérieur', 'elements' => ['Cour ou terrasse', 'Portail', 'Citerne et surpresseur']],
    ],
    'inspection_max_photos' => (int) env('INSPECTION_MAX_PHOTOS', 150),

    /*
    | Relances des factures impayées (loyers compris) : une tâche pour la personne qui suit le
    | client, à chaque palier de retard en jours. Fin de bail : alerte tant de jours avant la fin
    | prévue (préavis, état des lieux de sortie, caution). À valider avec l'agence.
    */
    'reminder_days' => array_map('intval', explode(',', (string) env('REMINDER_DAYS', '3,15,30'))),
    'lease_end_alert_days' => (int) env('LEASE_END_ALERT_DAYS', 60),

    /*
    | Travaux : validité d'un devis envoyé (jours) et acompte demandé à la commande (% du TTC,
    | modifiable devis par devis). À valider avec l'agence.
    */
    'quote_validity_days' => (int) env('QUOTE_VALIDITY_DAYS', 30),
    'quote_deposit_rate' => (float) env('QUOTE_DEPOSIT_RATE', 30),
    // Conditions proposées sur un nouveau devis (modifiables devis par devis).
    'quote_conditions' => "Validité : 30 jours. Acompte à la commande, solde à la réception des travaux.\nDélai d'exécution à convenir à la signature. Les travaux non prévus au devis feront l'objet d'un avenant.",
    // Corps de métier créés à l'installation (le cahier des charges v2.0 en liste 14, plus la peinture
    // proposée sur le site) ; liste à valider, modifiable dans le catalogue.
    'default_trades' => [
        'Maçonnerie et gros œuvre', 'Terrassement et fondations', 'Béton armé et ferraillage', 'Plomberie sanitaire',
        'Électricité', 'Menuiserie bois', 'Menuiserie aluminium et ferronnerie', 'Carrelage et revêtements',
        'Peinture et décoration', 'Étanchéité', 'Plâtrerie et faux plafonds', 'Climatisation et ventilation',
        'Charpente et couverture', 'Assainissement et VRD', 'Aménagement extérieur',
    ],

    /*
    | Chantiers : alerte (une tâche au chef de chantier) quand le coût réel dépasse le budget prévu
    | de plus de ce pourcentage. Le cahier des charges dit 10 %.
    */
    'budget_alert_tolerance' => (float) env('BUDGET_ALERT_TOLERANCE', 10),

    /*
    | Stock (lot 4) : catégories créées à l'installation (modifiables), délai de paiement des achats
    | fournisseurs, sortie refusée au-delà du stock disponible. À valider avec l'agence.
    */
    'default_article_categories' => [
        'Ciment et liants', 'Fers et aciers', 'Agrégats (sable, gravier)', 'Briques et agglos', 'Bois et coffrage',
        'Plomberie', 'Électricité', 'Carrelage et revêtements', 'Peinture', 'Quincaillerie et outillage',
    ],
    'purchase_due_days' => (int) env('PURCHASE_DUE_DAYS', 30),
    'stock_allow_negative' => (bool) env('STOCK_ALLOW_NEGATIVE', false),
];
