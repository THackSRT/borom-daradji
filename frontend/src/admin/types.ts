/** Formes des réponses de l'API (voir backend/app/Http/Resources). */

export interface Option<V extends string = string> {
  value: V;
  label: string;
}

export type RoleValue = "dirigeant" | "agent" | "responsable_travaux" | "comptable" | "commercial";

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
  roles: Option<RoleValue>[];
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
  | "task_priorities";

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
