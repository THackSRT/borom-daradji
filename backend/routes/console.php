<?php

use App\Models\ActivityLog;
use Illuminate\Support\Facades\Schedule;

// Purge du journal d'activité au-delà de la durée de conservation (1 an par défaut).
Schedule::command('model:prune', ['--model' => [ActivityLog::class]])->dailyAt('02:30');

// Mandats : alertes J-7 et clôture des mandats échus, avant l'arrivée des agents.
Schedule::command('borom:check-mandates')->dailyAt('07:00');
