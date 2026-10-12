import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useApiMutation, useOptions } from "../hooks";
import type { Client, CompanySettings, Invoice, InvoiceLine, Paginated, Property } from "../types";
import { AmountRow, cfa, computeLine, computeTotals, EntityPicker, MoneyInput, type PickerItem } from "../components/billing";
import { Field, FormError, LoadingBlock, PageHeader, Panel } from "../components/ui";

type DraftLine = Omit<InvoiceLine, "unit_price"> & { unit_price: number | ""; key: number };

let nextKey = 1;
const emptyLine = (vat: number): DraftLine => ({ key: nextKey++, description: "", quantity: 1, unit: "", unit_price: "", vat_rate: vat });

const searchClients = (term: string) =>
  api<Paginated<Client>>("/clients", { query: { search: term, per_page: 10 } })
    .then((r) => r.data.map((c) => ({ id: c.id, label: c.name, hint: c.phone ?? undefined })));
const searchProperties = (term: string) =>
  api<Paginated<Property>>("/properties", { query: { search: term, per_page: 10 } })
    .then((r) => r.data.map((p) => ({ id: p.id, label: `${p.reference} · ${p.title}` })));

/**
 * Création et modification d'un brouillon (facture ou avoir). Les totaux affichés suivent les mêmes
 * arrondis que le serveur, qui recalcule tout à l'enregistrement.
 */
export default function InvoiceEditorPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const activities = useOptions("activities");
  const editing = !!id;

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<{ data: CompanySettings }>("/settings/company").then((r) => r.data),
  });
  const defaultVat = settings?.vat_rate ?? 18;

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => api<{ data: Invoice }>(`/invoices/${id}`).then((r) => r.data),
    enabled: editing,
  });

  const [client, setClient] = useState<PickerItem | null>(null);
  const [property, setProperty] = useState<PickerItem | null>(null);
  const [activity, setActivity] = useState("immobilier");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>(() => [emptyLine(18)]);

  // Préremplissage : brouillon existant, ou client passé dans l'URL (depuis une fiche client).
  useEffect(() => {
    if (invoice) {
      setClient({ id: invoice.client.id, label: invoice.client.name });
      setProperty(invoice.property ? { id: invoice.property.id, label: `${invoice.property.reference} · ${invoice.property.title}` } : null);
      setActivity(invoice.activity.value);
      setIssueDate(invoice.issue_date ?? "");
      setDueDate(invoice.due_date ?? "");
      setNotes(invoice.notes ?? "");
      setLines((invoice.lines ?? []).map((l) => ({ ...l, unit: l.unit ?? "", key: nextKey++ })));
    }
  }, [invoice]);
  useEffect(() => {
    const clientId = params.get("client");
    const clientName = params.get("nom");
    if (!editing && clientId && clientName) setClient({ id: Number(clientId), label: clientName });
  }, [editing, params]);
  useEffect(() => {
    if (!editing && settings) setLines((prev) => prev.map((l) => (l.description || l.unit_price !== "" ? l : { ...l, vat_rate: settings.vat_rate })));
  }, [editing, settings]);

  const isCredit = invoice?.type.value === "avoir";
  const totals = computeTotals(lines.map((l) => ({ ...l, unit_price: Number(l.unit_price || 0) })));

  const payload = () => ({
    ...(isCredit ? {} : { client_id: client?.id }),
    property_id: property?.id ?? null,
    activity,
    issue_date: issueDate || null,
    due_date: dueDate || null,
    notes: notes || null,
    lines: lines.map(({ description, quantity, unit, unit_price, vat_rate }) => ({ description, quantity, unit: unit || null, unit_price: Number(unit_price || 0), vat_rate })),
  });

  const save = useApiMutation(
    async (issue: boolean) => {
      const saved = await api<{ data: Invoice }>(editing ? `/invoices/${id}` : "/invoices", { method: editing ? "PUT" : "POST", body: payload() });
      if (!issue) return saved;
      try {
        return await api<{ data: Invoice }>(`/invoices/${saved.data.id}/issue`, { method: "POST" });
      } catch (e) {
        // Le brouillon est enregistré : on y va, pour ne pas le recréer en double.
        toast.error(e instanceof ApiError ? e.field("invoice") ?? e.message : "Émission impossible.");
        navigate(`/admin/factures/${saved.data.id}`, { replace: true });
        throw e;
      }
    },
    {
      invalidate: [["invoices"], ["invoice"]],
      onSuccess: (result) => navigate(`/admin/factures/${result.data.id}`, { replace: true }),
    },
  );

  if (editing && (isLoading || !invoice)) return <LoadingBlock />;
  if (invoice && invoice.status.value !== "brouillon") {
    return <p className="text-sm text-muted-foreground">Cette facture est émise : elle ne se modifie plus. <Link className="text-primary underline" to={`/admin/factures/${invoice.id}`}>Retour à la facture</Link></p>;
  }

  const update = (key: number, patch: Partial<DraftLine>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const move = (index: number, to: number) => setLines((prev) => {
    if (to < 0 || to >= prev.length) return prev;
    const next = [...prev];
    const [line] = next.splice(index, 1);
    next.splice(to, 0, line);
    return next;
  });
  const err = (field: string) => save.error?.field(field);
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(false); };
  const title = isCredit ? `Avoir sur ${invoice?.credited_invoice?.number ?? "facture"}` : editing ? "Modifier le brouillon" : "Nouvelle facture";

  return (
    <form onSubmit={submit}>
      <Link to={editing ? `/admin/factures/${id}` : "/admin/factures"} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {editing ? "Retour à la facture" : "Factures"}
      </Link>
      <PageHeader title={title} description="Brouillon modifiable à volonté. Le numéro est attribué à l'émission." />

      <FormError message={err("invoice")} />

      <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <Panel title="Client et rattachement">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Client" error={err("client_id")} hint={isCredit ? "Celui de la facture d'origine." : undefined}>
                {isCredit ? <Input value={client?.label ?? ""} disabled /> : (
                  <EntityPicker value={client} onChange={setClient} search={searchClients} placeholder="Choisir un client" queryKey="clients" />
                )}
              </Field>
              <Field label="Activité" error={err("activity")} hint="Sert au chiffre d'affaires par activité.">
                <Select value={activity} onValueChange={setActivity}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{activities.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Bien concerné (facultatif)" error={err("property_id")}>
                <EntityPicker value={property} onChange={setProperty} search={searchProperties} placeholder="Aucun" queryKey="properties" allowClear />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date" htmlFor="issue_date" error={err("issue_date")} hint="Vide : date d'émission.">
                  <Input id="issue_date" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                </Field>
                {!isCredit && (
                  <Field label="Échéance" htmlFor="due_date" error={err("due_date")} hint="Vide : 15 jours.">
                    <Input id="due_date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                  </Field>
                )}
              </div>
            </div>
          </Panel>

          <Panel title="Lignes" description="Désignation, quantité, prix unitaire HT et taux de TVA de chaque ligne.">
            {err("lines") && <p className="mb-3 text-xs font-medium text-destructive">{err("lines")}</p>}
            <div className="space-y-3">
              {lines.map((line, index) => {
                const { amount } = computeLine({ ...line, unit_price: Number(line.unit_price || 0) });
                const prefix = `lines.${index}`;
                return (
                  <div key={line.key} className="rounded-lg border bg-muted/20 p-3">
                    <div className="flex items-start gap-2">
                      <span className="mt-2.5 w-5 shrink-0 text-xs font-medium text-muted-foreground">{index + 1}.</span>
                      <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-12">
                        <Field label="Désignation" error={err(`${prefix}.description`)} className="md:col-span-12">
                          <Input value={line.description} placeholder="Ex. Loyer octobre — appartement Mermoz" aria-label={`Désignation ligne ${index + 1}`}
                            onChange={(e) => update(line.key, { description: e.target.value })} />
                        </Field>
                        <Field label="Quantité" error={err(`${prefix}.quantity`)} className="md:col-span-2">
                          <Input type="number" min="0" step="0.01" value={line.quantity} aria-label={`Quantité ligne ${index + 1}`}
                            onChange={(e) => update(line.key, { quantity: e.target.value === "" ? 0 : Number(e.target.value) })} />
                        </Field>
                        <Field label="Unité" className="md:col-span-2">
                          <Input value={line.unit ?? ""} placeholder="mois, m², sac…" onChange={(e) => update(line.key, { unit: e.target.value })} />
                        </Field>
                        <Field label="Prix unitaire HT" error={err(`${prefix}.unit_price`)} className="md:col-span-4">
                          <MoneyInput value={line.unit_price} onChange={(v) => update(line.key, { unit_price: v })} />
                        </Field>
                        <Field label="TVA" error={err(`${prefix}.vat_rate`)} className="md:col-span-2">
                          <Select value={String(line.vat_rate)} onValueChange={(v) => update(line.key, { vat_rate: Number(v) })}>
                            <SelectTrigger aria-label={`TVA ligne ${index + 1}`}><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {[...new Set([defaultVat, 18, 0, line.vat_rate])].map((rate) => <SelectItem key={rate} value={String(rate)}>{rate} %</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </Field>
                        <div className="flex items-end justify-between gap-2 md:col-span-2 md:flex-col md:items-end md:justify-end">
                          <span className="text-xs text-muted-foreground md:hidden">Montant HT</span>
                          <span className="pb-2 text-sm font-semibold tabular-nums">{cfa(amount)}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col">
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label="Monter"><ArrowUp className="h-3.5 w-3.5" /></Button>
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={index === lines.length - 1} onClick={() => move(index, index + 1)} aria-label="Descendre"><ArrowDown className="h-3.5 w-3.5" /></Button>
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" disabled={lines.length === 1}
                          onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))} aria-label="Supprimer la ligne"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => setLines((prev) => [...prev, emptyLine(defaultVat)])}>
              <Plus className="h-4 w-4" /> Ajouter une ligne
            </Button>
          </Panel>

          <Panel title="Mentions">
            <Field label="Note imprimée sur la facture (facultatif)" htmlFor="notes" error={err("notes")}>
              <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Conditions particulières, période concernée…" />
            </Field>
          </Panel>
        </div>

        <aside className="xl:sticky xl:top-24 xl:self-start">
          <Panel title="Total">
            <AmountRow label="Total HT" value={totals.subtotal} tone="muted" />
            <AmountRow label="TVA" value={totals.vat} tone="muted" />
            <div className="my-2 border-t" />
            <AmountRow label={isCredit ? "Total de l'avoir" : "Total TTC"} value={totals.total} strong />
            {isCredit && invoice?.credited_invoice && <p className="mt-2 text-xs text-muted-foreground">Ne peut pas dépasser ce qui reste à créditer sur la facture d'origine.</p>}
            <div className="mt-5 space-y-2">
              <Button type="submit" variant="outline" className="w-full" disabled={save.isPending || (!isCredit && !client)}>Enregistrer le brouillon</Button>
              <Button type="button" className={cn("w-full")} disabled={save.isPending || (!isCredit && !client) || totals.total <= 0}
                onClick={() => window.confirm(`Émettre ${isCredit ? "l'avoir" : "la facture"} de ${cfa(totals.total)} ? Elle ne pourra plus être modifiée.`) && save.mutate(true)}>
                <Send className="h-4 w-4" /> Enregistrer et émettre
              </Button>
            </div>
          </Panel>
        </aside>
      </div>
    </form>
  );
}
