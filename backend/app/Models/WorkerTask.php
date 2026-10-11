<?php

namespace App\Models;

use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Travail à la tâche convenu avec un tâcheron (ex. « carrelage de la cuisine, 150 000 ») : dû une
 * fois terminé.
 */
#[Fillable(['worksite_id', 'worker_id', 'description', 'amount', 'status', 'completed_on', 'created_by'])]
class WorkerTask extends Model
{
    use LogsActivity;

    protected $attributes = ['status' => 'en_cours'];

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return ['amount' => 'integer', 'completed_on' => 'immutable_date'];
    }

    /**
     * @return BelongsTo<Worker, $this>
     */
    public function worker(): BelongsTo
    {
        return $this->belongsTo(Worker::class);
    }

    /**
     * @return BelongsTo<Worksite, $this>
     */
    public function worksite(): BelongsTo
    {
        return $this->belongsTo(Worksite::class);
    }
}
