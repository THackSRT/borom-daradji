<?php

return [

    /*
    | Durée de conservation du journal d'activité, en jours (1 an par défaut).
    */
    'activity_retention_days' => (int) env('ACTIVITY_RETENTION_DAYS', 365),

];
