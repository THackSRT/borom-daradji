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
];
