<?php

namespace App\Models;

use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Pointage : un tâcheron présent sur un chantier un jour donné (journée entière ou demi-journée), au
 * tarif du jour figé dans la ligne.
 */
#[Fillable(['worksite_id', 'worker_id', 'worked_on', 'days', 'daily_rate', 'amount', 'note', 'client_uuid', 'recorded_by'])]
class WorksiteAttendance extends Model
{
    use LogsActivity;

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return ['worked_on' => 'immutable_date', 'days' => 'float', 'daily_rate' => 'integer', 'amount' => 'integer'];
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
