<?php

namespace App\Models;

use App\Models\Concerns\LogsActivity;
use App\Support\PhoneNumber;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Tâcheron : artisan ou ouvrier payé à la journée (pointage) ou à la tâche, souvent en espèces. Pas un
 * compte utilisateur. Désactivé plutôt que supprimé (son historique de paiements reste).
 */
#[Fillable(['name', 'phone', 'trade_id', 'pay_type', 'daily_rate', 'is_active', 'notes', 'created_by'])]
class Worker extends Model
{
    use LogsActivity;

    protected $attributes = ['pay_type' => 'journalier', 'daily_rate' => 0, 'is_active' => true];

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return ['daily_rate' => 'integer', 'is_active' => 'boolean'];
    }

    protected function phone(): Attribute
    {
        return Attribute::make(set: fn (?string $value) => PhoneNumber::normalize($value) ?? $value);
    }

    /**
     * @return BelongsTo<Trade, $this>
     */
    public function trade(): BelongsTo
    {
        return $this->belongsTo(Trade::class);
    }

    /**
     * @return HasMany<WorksiteAttendance, $this>
     */
    public function attendances(): HasMany
    {
        return $this->hasMany(WorksiteAttendance::class);
    }

    /**
     * @return HasMany<WorkerTask, $this>
     */
    public function tasks(): HasMany
    {
        return $this->hasMany(WorkerTask::class);
    }

    /**
     * @return HasMany<WorkerPayment, $this>
     */
    public function payments(): HasMany
    {
        return $this->hasMany(WorkerPayment::class);
    }

    /** Dû au tâcheron : journées pointées + tâches terminées. */
    public function earned(?int $worksiteId = null): int
    {
        $attendances = $this->attendances()->when($worksiteId, fn ($q) => $q->where('worksite_id', $worksiteId))->sum('amount');
        $tasks = $this->tasks()->where('status', 'terminee')->when($worksiteId, fn ($q) => $q->where('worksite_id', $worksiteId))->sum('amount');

        return (int) $attendances + (int) $tasks;
    }

    /** Déjà versé (avances et paiements valides). */
    public function paid(?int $worksiteId = null): int
    {
        return (int) $this->payments()->whereNull('cancelled_at')->when($worksiteId, fn ($q) => $q->where('worksite_id', $worksiteId))->sum('amount');
    }

    /** Reste à payer (négatif : avance pas encore couverte par du travail). */
    public function balance(): int
    {
        return $this->earned() - $this->paid();
    }
}
