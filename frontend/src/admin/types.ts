/** Formes des réponses de l'API (voir backend/app/Http/Resources). */

export interface Option<V extends string = string> {
  value: V;
  label: string;
}

/** Rôles fournis par défaut ; le dirigeant peut en créer d'autres (RBAC). */
export type RoleValue = string;

export interface Paginated<T> {
  data: T[];
  meta: { current_page: number; last_page: number; total: number; per_page: number };
  status_counts?: Record<string, number>;
}

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  roles: (Option<RoleValue> & { id: number; is_super_admin: boolean })[];
  is_super_admin: boolean;
  /** Permissions données en plus des rôles. */
  direct_permissions: string[];
  /** Toutes les permissions du compte (rôles + individuelles). */
  permissions: string[];
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface CompanySettings {
  trade_name: string;
  legal_name: string | null;
  ninea: string | null;
  rccm: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  bank_name: string | null;
  bank_account: string | null;
  vat_rate: number;
  currency: string;
  invoice_footer: string | null;
}

export interface ActivityLog {
  id: number;
  action: string;
  description: string | null;
  subject_type: string | null;
  subject_id: number | null;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  user: { id: number; name: string } | null;
  ip_address: string | null;
  created_at: string;
}

export interface Ref {
  id: number;
  name: string;
}

export interface PropertyPhoto {
  id: number;
  url: string;
  position: number;
  is_cover: boolean;
}

export interface PropertyCheck {
  id: number;
  item: Option;
  status: Option<"a_faire" | "ok" | "ko" | "sans_objet">;
  is_cleared: boolean;
  is_expired: boolean;
  note: string | null;
  document_id: number | null;
  checked_by: string | null;
  checked_at: string | null;
}

export interface Property {
  id: number;
  reference: string;
  slug: string;
  title: string;
  type: Option;
  transaction: Option<"vente" | "location">;
  status: Option;
  price: number;
  charges: number | null;
  deposit_months: number | null;
  advance_months: number | null;
  surface: number | null;
  land_surface: number | null;
  rooms: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  features: string[];
  city: string;
  neighborhood: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  land_status: Option;
  land_reference: string | null;
  is_featured: boolean;
  published_at: string | null;
  cover_url?: string | null;
  checks_progress?: { cleared: number; total: number };
  owner?: { id: number; name: string; phone: string | null } | null;
  agent?: Ref | null;
  photos?: PropertyPhoto[];
  checks?: PropertyCheck[];
  status_changes?: { from: Option | null; to: Option; reason: string | null; user: string | null; at: string }[];
  can: { update: boolean; view_documents: boolean };
  created_at: string;
}

export interface DocumentItem {
  id: number;
  type: Option;
  original_name: string;
  created_at: string;
}

export interface Mandate {
  id: number;
  owner: Ref | null;
  type: Option;
  starts_on: string;
  ends_on: string;
  commission_type: Option<"pourcentage" | "montant">;
  commission_value: number;
  status: Option;
  conditions: string | null;
}

export interface SearchCriterion {
  id: number;
  transaction: Option;
  types: Option[];
  budget_min: number | null;
  budget_max: number | null;
  cities: string[];
  neighborhoods: string[];
  rooms_min: number | null;
  is_active: boolean;
}

export interface Interaction {
  id: number;
  channel: Option;
  summary: string;
  occurred_at: string;
  user: Ref | null;
  property: { id: number; reference: string } | null;
}

export interface Visit {
  id: number;
  scheduled_at: string;
  status: Option<"planifiee" | "effectuee" | "annulee" | "absent">;
  feedback: Option | null;
  notes: string | null;
  next_action: string | null;
  property: { id: number; reference: string; title: string; neighborhood: string | null } | null;
  client: { id: number; name: string; phone: string | null; whatsapp_url: string | null } | null;
  agent: Ref | null;
}

export interface Client {
  id: number;
  kind: Option;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  whatsapp_url: string | null;
  email: string | null;
  categories: Option[];
  city: string | null;
  address: string | null;
  source: Option | null;
  pipeline_status: Option;
  solvency: string | null;
  tags: string[];
  assigned_user?: Ref | null;
  last_contact_at: string | null;
  private_notes?: string | null;
  search_criteria?: SearchCriterion[];
  interactions?: Interaction[];
  visits?: Visit[];
  can: { view_documents: boolean; delete: boolean };
  created_at: string;
}

export interface Task {
  id: number;
  title: string;
  details: string | null;
  due_at: string;
  is_overdue: boolean;
  priority: Option<"basse" | "normale" | "haute">;
  done_at: string | null;
  user: Ref | null;
  client: { id: number; name: string; phone: string | null; whatsapp_url: string | null } | null;
  property: { id: number; reference: string } | null;
}

export type MetaKey =
  | "roles"
  | "property_types"
  | "transaction_types"
  | "property_statuses"
  | "land_statuses"
  | "property_check_items"
  | "check_statuses"
  | "property_document_types"
  | "client_kinds"
  | "client_categories"
  | "client_document_types"
  | "lead_sources"
  | "pipeline_statuses"
  | "interaction_channels"
  | "visit_statuses"
  | "visit_feedbacks"
  | "mandate_types"
  | "mandate_statuses"
  | "commission_types"
  | "task_priorities"
  | "invoice_types"
  | "invoice_statuses"
  | "payment_states"
  | "activities"
  | "payment_methods"
  | "cash_movement_types"
  | "lease_statuses";

export type Meta = Record<MetaKey, Option[]>;

export interface Dashboard {
  kpis: {
    published: number;
    drafts: number;
    new_leads: number;
    leads_this_week: number;
    visits_today: number;
    visits_week: number;
    tasks_overdue: number;
    tasks_today: number;
    mandates_expiring: number;
  };
  visits_today: Visit[];
  new_leads: Client[];
  drafts: (Property & { checks_progress?: { cleared: number; total: number } })[];
  tasks: Task[];
}

export interface InvoiceLine {
  id?: number;
  description: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  vat_rate: number;
  amount?: number;
  vat_amount?: number;
}

export interface Payment {
  id: number;
  number: string;
  invoice?: { id: number; number: string };
  client?: Ref;
  method: Option;
  amount: number;
  paid_on: string;
  reference: string | null;
  has_proof: boolean;
  note: string | null;
  received_by?: Ref;
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
}

export interface Invoice {
  id: number;
  type: Option<"facture" | "avoir">;
  number: string | null;
  status: Option<"brouillon" | "emise">;
  payment_state: Option<"non_payee" | "partielle" | "payee" | "annulee"> | null;
  is_overdue: boolean;
  client: { id: number; name: string; phone: string | null };
  property?: { id: number; reference: string; title: string } | null;
  activity: Option;
  credited_invoice?: { id: number; number: string | null } | null;
  issue_date: string | null;
  due_date: string | null;
  subtotal: number;
  vat_total: number;
  total: number;
  paid_total: number;
  credited_total: number;
  balance: number;
  notes: string | null;
  lines?: InvoiceLine[];
  payments?: Payment[];
  credit_notes?: { id: number; number: string | null; status: Option; total: number }[];
  whatsapp_reminder_url?: string | null;
  issued_at: string | null;
  created_at: string;
  can: { update: boolean; issue: boolean; delete: boolean; credit: boolean; pay: boolean; cancel_payment: boolean };
}

export interface InvoiceSummary {
  outstanding: number;
  overdue: number;
  overdue_count: number;
  drafts: number;
}

export interface CashSession {
  id: number;
  user?: Ref;
  date: string;
  is_today: boolean;
  opening_amount: number;
  cash_in: number;
  movements_total: number;
  expected_amount: number;
  counted_amount: number | null;
  difference: number | null;
  closing_note: string | null;
  closed_at: string | null;
  other_methods?: { method: Option; total: number; count: number }[];
  payments?: Payment[];
  movements?: { id: number; type: Option; amount: number; label: string; created_at: string }[];
}

export interface Role {
  id: number;
  name: string;
  label: string;
  description: string | null;
  is_system: boolean;
  is_super_admin: boolean;
  permissions: string[];
  users_count: number;
  updated_at: string;
}

export interface PermissionModule {
  key: string;
  label: string;
  permissions: { name: string; label: string; description: string | null; roles: string[] }[];
}

export interface RentCallRow {
  id: number;
  period: string;
  invoice: {
    id: number;
    number: string | null;
    status: Option;
    due_date: string | null;
    total: number;
    paid_total: number;
    balance: number;
    payment_state: Option | null;
    is_overdue: boolean;
  };
  can_quittance: boolean;
}

export interface Lease {
  id: number;
  reference: string;
  status: Option<"actif" | "resilie">;
  property: { id: number; reference: string; title: string };
  tenant: { id: number; name: string; phone: string | null };
  owner: { id: number; name: string } | null;
  agent?: { id: number; name: string } | null;
  start_date: string;
  end_date: string | null;
  billing_start: string;
  rent: number;
  charges: number;
  deposit: number;
  advance_months: number;
  due_day: number;
  rent_vat_rate: number;
  managed: boolean;
  commission_rate: number;
  terminated_on: string | null;
  termination_reason: string | null;
  notes: string | null;
  entry_invoice?: { id: number; number: string | null; status: Option; total: number; balance: number } | null;
  arrears?: number;
  months_overdue?: number;
  rent_calls?: RentCallRow[];
  whatsapp_reminder_url?: string | null;
  can: { update: boolean } | null;
}

export interface LeaseSummary {
  active: number;
  monthly_rent: number;
  arrears: number;
  leases_in_arrears: number;
}

export interface OwnerPayoutRow {
  id: number;
  number: string;
  owner: Ref;
  period: string;
  collected: number;
  commission: number;
  commission_vat: number;
  expenses: number;
  net: number;
  method: Option;
  reference: string | null;
  paid_on: string;
  note: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
}

export interface OwnerStatement {
  owner: { id: number; name: string; phone: string | null };
  period: string;
  lines: { payment_id: number; receipt: string; paid_on: string; lease: string; property: string; tenant: string; month: string; amount: number; commission_rate: number; commission: number }[];
  collected: number;
  commission: number;
  commission_vat: number;
  net_before_expenses: number;
}
