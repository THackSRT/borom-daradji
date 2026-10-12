<?php

use App\Models\ActivityLog;
use Illuminate\Support\Facades\Schedule;

// Purge du journal d'activité au-delà de la durée de conservation (1 an par défaut).
Schedule::command('model:prune', ['--model' => [ActivityLog::class]])->dailyAt('02:30');

// Mandats : alertes J-7 et clôture des mandats échus, avant l'arrivée des agents.
Schedule::command('borom:check-mandates')->dailyAt('07:00');

// Appels de loyer du mois : chaque matin, pour les baux en cours (sans doublon).
Schedule::command('borom:generate-rent-calls')->dailyAt('06:00');

// Fins de bail proches : alerte à l'agent (préavis, état des lieux de sortie, caution).
Schedule::command('borom:check-lease-ends')->dailyAt('07:05');

// Relances des impayés : tâches à J+3, J+15, J+30, avant l'arrivée des équipes.
Schedule::command('borom:remind-overdue')->dailyAt('07:10');

// Devis envoyés dont la validité est dépassée : « expiré ».
Schedule::command('borom:expire-quotes')->dailyAt('00:15');
