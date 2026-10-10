<?php

namespace App\Http\Controllers\Api;

use App\Enums\MandateStatus;
use App\Enums\PipelineStatus;
use App\Enums\PropertyStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\ClientResource;
use App\Http\Resources\PropertyResource;
use App\Http\Resources\TaskResource;
use App\Http\Resources\VisitResource;
use App\Models\Client;
use App\Models\Mandate;
use App\Models\Property;
use App\Models\Task;
use App\Models\Visit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Page d'accueil du back-office : ce qui demande une action aujourd'hui.
 * Le dirigeant voit toute l'agence, les autres leur propre portefeuille.
 */
class DashboardController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        $all = $user->isDirigeant();
        $endOfDay = now()->endOfDay();

        $properties = Property::query()->when(! $all, fn ($q) => $q->where('agent_id', $user->id));
        $clients = Client::query()->when(! $all, fn ($q) => $q->where('assigned_user_id', $user->id));
        $visits = Visit::query()->when(! $all, fn ($q) => $q->where('agent_id', $user->id));
        $tasks = Task::query()->open()->where('user_id', $user->id);

        $visitsToday = (clone $visits)
            ->with(['property:id,reference,title,neighborhood', 'client:id,name,phone,whatsapp', 'agent:id,name'])
            ->whereBetween('scheduled_at', [now()->startOfDay(), $endOfDay])
            ->orderBy('scheduled_at')
            ->get();

        $newLeads = (clone $clients)
            ->with('assignedUser:id,name')
            ->where('pipeline_status', PipelineStatus::Nouveau)
            ->latest()
            ->limit(5)
            ->get();

        $drafts = (clone $properties)
            ->with('cover')
            ->withCount(['checks', 'checks as checks_cleared_count' => fn ($q) => $q->whereIn('status', ['ok', 'sans_objet'])])
            ->where('status', PropertyStatus::Brouillon)
            ->latest()
            ->limit(5)
            ->get();

        $dueTasks = (clone $tasks)
            ->with(['client:id,name,phone,whatsapp', 'property:id,reference'])
            ->where('due_at', '<=', $endOfDay)
            ->orderBy('due_at')
            ->limit(6)
            ->get();

        return response()->json([
            'data' => [
                'kpis' => [
                    'published' => (clone $properties)->published()->count(),
                    'drafts' => (clone $properties)->where('status', PropertyStatus::Brouillon)->count(),
                    'new_leads' => (clone $clients)->where('pipeline_status', PipelineStatus::Nouveau)->count(),
                    'leads_this_week' => (clone $clients)->where('created_at', '>=', now()->subDays(7))->count(),
                    'visits_today' => $visitsToday->count(),
                    'visits_week' => (clone $visits)->whereBetween('scheduled_at', [now()->startOfWeek(), now()->endOfWeek()])->count(),
                    'tasks_overdue' => (clone $tasks)->where('due_at', '<', now())->count(),
                    'tasks_today' => (clone $tasks)->where('due_at', '<=', $endOfDay)->count(),
                    'mandates_expiring' => Mandate::query()
                        ->where('status', MandateStatus::Actif)
                        ->whereDate('ends_on', '<=', now()->addDays(30))
                        ->when(! $all, fn ($q) => $q->whereHas('property', fn ($p) => $p->where('agent_id', $user->id)))
                        ->count(),
                ],
                'visits_today' => VisitResource::collection($visitsToday),
                'new_leads' => ClientResource::collection($newLeads),
                'drafts' => PropertyResource::collection($drafts),
                'tasks' => TaskResource::collection($dueTasks),
            ],
        ]);
    }
}
