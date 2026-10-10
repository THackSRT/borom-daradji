<?php

use App\Models\ActivityLog;
use Illuminate\Support\Facades\Schedule;

// Purge du journal d'activité au-delà de la durée de conservation (1 an par défaut).
Schedule::command('model:prune', ['--model' => [ActivityLog::class]])->dailyAt('02:30');
