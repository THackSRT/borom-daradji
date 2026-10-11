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

];
