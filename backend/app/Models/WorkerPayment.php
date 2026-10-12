<?php

namespace App\Models;

use App\Enums\PaymentMethod;
use App\Models\Concerns\LogsActivity;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Avance ou paiement versé à un tâcheron. Jamais supprimé : annulé avec un motif.
 */
#[Fillable(['worker_id', 'worksite_id', 'kind', 'amount', 'paid_on', 'method', 'reference', 'note', 'site_cash_entry_id', 'paid_by'])]
class WorkerPayment extends Model
{
    use LogsActivity;

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return ['amount' => 'integer', 'paid_on' => 'immutable_date', 'method' => PaymentMethod::class, 'cancelled_at' => 'datetime'];
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

    /**
     * @return BelongsTo<SiteCashEntry, $this>
     */
    public function siteCashEntry(): BelongsTo
    {
        return $this->belongsTo(SiteCashEntry::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function payer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'paid_by');
    }

    public function isCancelled(): bool
    {
        return $this->cancelled_at !== null;
    }
}
