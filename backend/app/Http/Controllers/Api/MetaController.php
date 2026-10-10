<?php

namespace App\Http\Controllers\Api;

use App\Enums\Activity;
use App\Enums\CashMovementType;
use App\Enums\CheckStatus;
use App\Enums\ClientCategory;
use App\Enums\ClientDocumentType;
use App\Enums\ClientKind;
use App\Enums\CommissionType;
use App\Enums\InteractionChannel;
use App\Enums\InvoiceStatus;
use App\Enums\InvoiceType;
use App\Enums\LandStatus;
use App\Enums\LeadSource;
use App\Enums\LeaseStatus;
use App\Enums\MandateStatus;
use App\Enums\MandateType;
use App\Enums\PaymentMethod;
use App\Enums\PaymentState;
use App\Enums\PipelineStatus;
use App\Enums\PropertyCheckItem;
use App\Enums\PropertyDocumentType;
use App\Enums\PropertyStatus;
use App\Enums\PropertyType;
use App\Enums\TaskPriority;
use App\Enums\TransactionType;
use App\Enums\VisitFeedback;
use App\Enums\VisitStatus;
use App\Http\Controllers\Controller;
use App\Models\Role;
use Illuminate\Http\JsonResponse;

/**
 * Valeurs et libellés français de toutes les listes fermées, pour construire les formulaires du front.
 */
class MetaController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $enums = [
            'property_types' => PropertyType::class,
            'transaction_types' => TransactionType::class,
            'property_statuses' => PropertyStatus::class,
            'land_statuses' => LandStatus::class,
            'property_check_items' => PropertyCheckItem::class,
            'check_statuses' => CheckStatus::class,
            'property_document_types' => PropertyDocumentType::class,
            'client_kinds' => ClientKind::class,
            'client_categories' => ClientCategory::class,
            'client_document_types' => ClientDocumentType::class,
            'lead_sources' => LeadSource::class,
            'pipeline_statuses' => PipelineStatus::class,
            'interaction_channels' => InteractionChannel::class,
            'visit_statuses' => VisitStatus::class,
            'visit_feedbacks' => VisitFeedback::class,
            'mandate_types' => MandateType::class,
            'mandate_statuses' => MandateStatus::class,
            'commission_types' => CommissionType::class,
            'task_priorities' => TaskPriority::class,
            'invoice_types' => InvoiceType::class,
            'invoice_statuses' => InvoiceStatus::class,
            'payment_states' => PaymentState::class,
            'activities' => Activity::class,
            'payment_methods' => PaymentMethod::class,
            'cash_movement_types' => CashMovementType::class,
            'lease_statuses' => LeaseStatus::class,
        ];

        $data = array_map(
            fn (string $enum) => array_map(fn ($case) => ['value' => $case->value, 'label' => $case->label()], $enum::cases()),
            $enums,
        );

        // Rôles : définis par le dirigeant (RBAC), lus en base.
        $data['roles'] = Role::query()->orderByDesc('is_system')->orderBy('label')->get()
            ->map(fn (Role $role) => ['value' => $role->name, 'label' => $role->label])->all();

        return response()->json(['data' => $data]);
    }
}
