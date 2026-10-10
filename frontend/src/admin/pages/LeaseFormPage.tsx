import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useApiMutation } from "../hooks";
import type { Client, Lease, Paginated, Property } from "../types";
import { AmountRow, cfa, EntityPicker, MoneyInput, type PickerItem } from "../components/billing";
import { Field, FormError, PageHeader, Panel } from "../components/ui";

interface Defaults {
  due_day: number;
  rent_vat_rate: number;
  commission_rate: number;
  management_fee_vat_rate: number;
  agency_fee_vat_rate: number;
}

const searchProperties = (term: string) =>
  api<Paginated<Property>>("/properties", { query: { search: term, transaction: "location", per_page: 10 } })
    .then((r) => r.data.map((p) => ({ id: p.id, label: `${p.reference} · ${p.title}`, hint: p.status.label })));
const searchClients = (term: string) =>
  api<Paginated<Client>>("/clients", { query: { search: term, per_page: 10 } })
    .then((r) => r.data.map((c) => ({ id: c.id, label: c.name, hint: c.phone ?? undefined })));

/**
 * Nouveau bail. Les montants sont préremplis depuis la fiche du bien (loyer, charges, caution,
 * avance) et restent modifiables ; les mois payés d'avance sont appelés dès la signature.
 */
export default function LeaseFormPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const today = new Date().toISOString().slice(0, 10);
  const { data: defaults } = useQuery({ queryKey: ["lease-defaults"], queryFn: () => api<{ data: Defaults }>("/leases/defaults").then((r) => r.data) });

  const [property, setProperty] = useState<PickerItem | null>(null);
  const [tenant, setTenant] = useState<PickerItem | null>(null);
  const [form, setForm] = useState({
    start_date: today,
    end_date: "",
    rent: "" as number | "",
    charges: 0 as number | "",
    deposit: 0 as number | "",
    advance_months: 1,
    due_day: 5,
    managed: false,
    commission_rate: 10,
    entry_invoice: true,
    agency_fee: "" as number | "",
    notes: "",
  });
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (defaults) setForm((f) => ({ ...f, due_day: defaults.due_day, commission_rate: defaults.commission_rate }));
  }, [defaults]);

  // Bien choisi : on reprend ses conditions de location et son propriétaire.
  const { data: details } = useQuery({
    queryKey: ["property", String(property?.id)],
    queryFn: () => api<{ data: Property }>(`/properties/${property!.id}`).then((r) => r.data),
    enabled: !!property,
  });
  useEffect(() => {
    if (!details) return;
    const rent = details.price;
    setForm((f) => ({
      ...f,
      rent,
      charges: details.charges ?? 0,
      deposit: rent * (details.deposit_months ?? 0),
      advance_months: details.advance_months ?? 1,
      agency_fee: rent,
      managed: !!details.owner,
    }));
  }, [details]);

  // Arrivée depuis la fiche d'un bien.
  const presetProperty = params.get("bien");
  const { data: preset } = useQuery({
    queryKey: ["property", presetProperty],
    queryFn: () => api<{ data: Property }>(`/properties/${presetProperty}`).then((r) => r.data),
    enabled: !!presetProperty,
  });
  useEffect(() => {
    if (preset && !property) setProperty({ id: preset.id, label: `${preset.reference} · ${preset.title}` });
  }, [preset, property]);

  const mutation = useApiMutation(
    () => api<{ data: Lease }>("/leases", {
      method: "POST",
      body: {
        property_id: property?.id,
        tenant_id: tenant?.id,
        start_date: form.start_date,
        end_date: form.end_date || null,
        rent: form.rent || 0,
        charges: form.charges || 0,
        deposit: form.deposit || 0,
        advance_months: form.advance_months,
        due_day: form.due_day,
        managed: form.managed,
        commission_rate: form.managed ? form.commission_rate : 0,
        entry_invoice: form.entry_invoice,
        agency_fee: form.entry_invoice ? form.agency_fee || 0 : 0,
        notes: form.notes || null,
      },
    }),
    { success: "Bail créé.", invalidate: [["leases"], ["invoices"], ["properties"]], onSuccess: (r) => navigate(`/admin/baux/${r.data.id}`) },
  );

  const err = (f: string) => mutation.error?.field(f);
  const monthly = Number(form.rent || 0) + Number(form.charges || 0);
  const agencyFeeTtc = Math.round(Number(form.agency_fee || 0) * (1 + (defaults?.agency_fee_vat_rate ?? 18) / 100));
  const atSigning = Number(form.deposit || 0) + monthly * form.advance_months + (form.entry_invoice ? agencyFeeTtc : 0);
  const submit = (e: FormEvent) => { e.preventDefault(); mutation.mutate(undefined); };

  return (
    <form onSubmit={submit}>
      <Link to="/admin/baux" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Baux</Link>
      <PageHeader title="Nouveau bail" description="Le bien passe en « Loué » ; chaque mois, l'appel de loyer est émis au locataire." />
      <FormError message={err("entry_invoice")} />

      <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Panel title="Bien et locataire">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Bien à louer" error={err("property_id")}>
                <EntityPicker value={property} onChange={setProperty} search={searchProperties} placeholder="Choisir un bien" queryKey="rental-properties" />
              </Field>
              <Field label="Locataire" error={err("tenant_id")} hint="Créez-le d'abord dans Clients s'il n'existe pas.">
                <EntityPicker value={tenant} onChange={setTenant} search={searchClients} placeholder="Choisir un client" queryKey="tenants" />
              </Field>
            </div>
            {details && (
              <p className="mt-3 text-sm text-muted-foreground">
                Propriétaire : <strong className="text-foreground">{details.owner?.name ?? "non renseigné"}</strong>
                {details.agent && <> · agent : {details.agent.name}</>} · statut : {details.status.label}
              </p>
            )}
          </Panel>

          <Panel title="Loyer et dates">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Loyer mensuel" error={err("rent")}><MoneyInput value={form.rent} onChange={(rent) => set({ rent })} /></Field>
              <Field label="Charges mensuelles" error={err("charges")}><MoneyInput value={form.charges} onChange={(charges) => set({ charges })} /></Field>
              <Field label="Jour d'échéance" htmlFor="due_day" error={err("due_day")} hint="Le loyer est dû ce jour-là chaque mois.">
                <Input id="due_day" type="number" min={1} max={28} value={form.due_day} onChange={(e) => set({ due_day: Number(e.target.value) })} />
              </Field>
              <Field label="Date d'entrée" htmlFor="start_date" error={err("start_date")}>
                <Input id="start_date" type="date" value={form.start_date} onChange={(e) => set({ start_date: e.target.value })} />
              </Field>
              <Field label="Fin prévue (facultatif)" htmlFor="end_date" error={err("end_date")}>
                <Input id="end_date" type="date" value={form.end_date} onChange={(e) => set({ end_date: e.target.value })} />
              </Field>
            </div>
          </Panel>

          <Panel title="Entrée dans les lieux" description="Conditions habituelles à Dakar : caution et mois d'avance. À ajuster selon le bail.">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Caution" error={err("deposit")} hint={form.rent ? `${Math.round(Number(form.deposit || 0) / Number(form.rent))} mois de loyer` : undefined}>
                <MoneyInput value={form.deposit} onChange={(deposit) => set({ deposit })} />
              </Field>
              <Field label="Mois payés d'avance" htmlFor="advance" error={err("advance_months")} hint="Appelés dès la signature.">
                <Input id="advance" type="number" min={0} max={12} value={form.advance_months} onChange={(e) => set({ advance_months: Number(e.target.value) })} />
              </Field>
            </div>
            <label className="mt-4 flex items-center justify-between gap-4 rounded-lg border bg-muted/30 px-4 py-3">
              <span>
                <span className="block text-sm font-medium">Préparer la facture d'entrée</span>
                <span className="block text-xs text-muted-foreground">Caution et frais d'agence, en brouillon pour le comptable.</span>
              </span>
              <Switch checked={form.entry_invoice} onCheckedChange={(entry_invoice) => set({ entry_invoice })} />
            </label>
            {form.entry_invoice && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Frais d'agence (HT)" hint={`TVA ${defaults?.agency_fee_vat_rate ?? 18} % en plus`}>
                  <MoneyInput value={form.agency_fee} onChange={(agency_fee) => set({ agency_fee })} />
                </Field>
              </div>
            )}
          </Panel>

          <Panel title="Gestion locative" description="L'agence encaisse les loyers et les reverse au propriétaire, moins sa commission.">
            <label className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium">Bail en gestion</span>
              <Switch checked={form.managed} onCheckedChange={(managed) => set({ managed })} />
            </label>
            {form.managed && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Commission (% des loyers encaissés)" htmlFor="commission" error={err("commission_rate") ?? err("owner_id")}
                  hint={`TVA ${defaults?.management_fee_vat_rate ?? 18} % sur la commission`}>
                  <Input id="commission" type="number" min={0} max={100} step="0.5" value={form.commission_rate} onChange={(e) => set({ commission_rate: Number(e.target.value) })} />
                </Field>
              </div>
            )}
          </Panel>

          <Panel title="Notes">
            <Textarea rows={3} value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Clauses particulières, état du logement à l'entrée…" />
          </Panel>
        </div>

        <aside className="xl:sticky xl:top-24 xl:self-start">
          <Panel title="Résumé">
            <AmountRow label="Loyer + charges / mois" value={monthly} strong />
            <p className="mb-3 text-xs text-muted-foreground">Dû le {form.due_day} de chaque mois, à partir du {formatDate(form.start_date)}.</p>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">À la signature</p>
            <AmountRow label="Caution" value={Number(form.deposit || 0)} tone="muted" />
            <AmountRow label={`${form.advance_months} mois d'avance`} value={monthly * form.advance_months} tone="muted" />
            {form.entry_invoice && <AmountRow label="Frais d'agence TTC" value={agencyFeeTtc} tone="muted" />}
            <div className="my-1.5 border-t" />
            <AmountRow label="Total à l'entrée" value={atSigning} strong />
            {form.managed && Number(form.rent) > 0 && (
              <p className="mt-3 flex gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                <Info className="h-4 w-4 shrink-0" />
                Le propriétaire reçoit environ {cfa(Math.round(monthly * (1 - (form.commission_rate / 100) * (1 + (defaults?.management_fee_vat_rate ?? 18) / 100))))} par mois payé.
              </p>
            )}
            <Button type="submit" className="mt-5 w-full" disabled={mutation.isPending || !property || !tenant || !form.rent}>Créer le bail</Button>
          </Panel>
        </aside>
      </div>
    </form>
  );
}
