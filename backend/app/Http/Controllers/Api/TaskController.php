<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\TaskRequest;
use App\Http\Resources\TaskResource;
use App\Models\Task;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

class TaskController extends Controller
{
    /**
     * « Mes tâches » par défaut ; le dirigeant peut demander toutes les tâches (all=1).
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'all' => ['nullable', 'boolean'],
            'user_id' => ['nullable', 'integer'],
            'state' => ['nullable', Rule::in(['open', 'done'])],
            'due' => ['nullable', Rule::in(['today', 'overdue', 'week'])],
        ]);

        $user = $request->user();
        $seeAll = $request->boolean('all') && $user->can('viewAll', Task::class);

        $tasks = Task::query()
            ->with(['user:id,name', 'client:id,name,phone,whatsapp', 'property:id,reference'])
            ->when(! $seeAll, fn ($q) => $q->where('user_id', $user->id))
            ->when($seeAll && isset($filters['user_id']), fn ($q) => $q->where('user_id', $filters['user_id']))
            ->when(($filters['state'] ?? 'open') === 'open', fn ($q) => $q->whereNull('done_at'), fn ($q) => $q->whereNotNull('done_at'))
            ->when(($filters['due'] ?? null) === 'today', fn ($q) => $q->where('due_at', '<=', now()->endOfDay()))
            ->when(($filters['due'] ?? null) === 'overdue', fn ($q) => $q->where('due_at', '<', now()))
            ->when(($filters['due'] ?? null) === 'week', fn ($q) => $q->where('due_at', '<=', now()->endOfWeek()))
            ->orderBy('due_at')
            ->paginate(50)
            ->withQueryString();

        return TaskResource::collection($tasks);
    }

    public function store(TaskRequest $request): TaskResource
    {
        $task = Task::create([
            ...$request->safe()->except('done'),
            'user_id' => $request->input('user_id', $request->user()->id),
            'created_by' => $request->user()->id,
        ]);

        return new TaskResource($task->load(['user', 'client', 'property']));
    }

    public function update(TaskRequest $request, Task $task): TaskResource
    {
        $task->fill($request->safe()->except('done'));

        if ($request->has('done')) {
            $task->done_at = $request->boolean('done') ? ($task->done_at ?? now()) : null;
        }

        $task->save();

        return new TaskResource($task->load(['user', 'client', 'property']));
    }

    public function destroy(Task $task): Response
    {
        Gate::authorize('delete', $task);

        $task->delete();

        return response()->noContent();
    }
}
