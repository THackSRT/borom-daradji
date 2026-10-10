import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarPlus, Download, FileText, Pencil, Phone, Receipt, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api, downloadFile } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApiMutation } from "../hooks";
import type { Invoice, Lease } from "../types";
import { AmountRow, cfa, InvoiceStateBadge, MoneyInput } from "../components/billing";
import { EmptyState, Field, FormError, LoadingBlock, Panel, StatusBadge, WhatsAppLink } from "../components/ui";
import { DepositPanel, InspectionsPanel } from "../components/rental";

export default function LeaseDetailPage() {
  const { id } = useParams();
  const [editing, setEditing] = useState(false);
  const [terminating, setTerminating] = useState(false);
  const { data: lease, isLoading, isError } = useQuery({
    queryKey: ["lease", id],
    queryFn: () => api<{ data: Lease }>(`/leases/${id}`).then((r) => r.data),
  });
  const generate = useApiMutation(() => api(`/leases/${id}/rent-calls`, { method: "POST" }), {
    success: "Appels de loyer à jour.", invalidate: [["lease", id], ["leases"], ["invoices"]],
  });

  if (isLoading) return <LoadingBlock />;
  if (isError || !lease) return <EmptyState title="Bail introuvable" action={<Button asChild variant="outline"><Link to="/admin/baux">Retour aux baux</Link></Button>} />;

  const active = lease.status.value === "actif";
  const calls = lease.rent_calls ?? [];
  const paidMonths = calls.filter((c) => c.invoice.balance <= 0 && c.invoice.paid_total > 0).length;

  return (
    <>
      <Link to="/admin/baux" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Baux</Link>

      <section className="mb-6 rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{lease.tenant.name}</h1>
              <StatusBadge option={active ? { value: "actif", label: "En cours" } : { value: "resilie", label: "Résilié" }} />
              {lease.managed && <StatusBadge option={{ value: "emise", label: "En gestion" }} />}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-mono">{lease.reference}</span> ·{" "}
              <Link className="font-medium text-foreground hover:underline" to={`/admin/biens/${lease.property.id}`}>{lease.property.title}</Link>
              {lease.owner && <> · propriétaire <Link className="hover:underline" to={`/admin/clients/${lease.owner.id}`}>{lease.owner.name}</Link></>}
            </p>
            {!active && <p className="mt-1 text-sm text-red-700">Résilié le {formatDate(lease.terminated_on)} : {lease.termination_reason}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {lease.tenant.phone && <Button asChild variant="outline"><a href={`tel:${lease.tenant.phone}`}><Phone className="h-4 w-4" /> Appeler</a></Button>}
            <WhatsAppLink url={lease.whatsapp_reminder_url} label="Relancer les arriérés" />
            {lease.can?.update && (
              <>
                <Button variant="outline" onClick={() => generate.mutate(undefined)} disabled={generate.isPending}><CalendarPlus className="h-4 w-4" /> Appeler le loyer</Button>
                <Button variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Modifier</Button>
                <Button variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => setTerminating(true)}><XCircle className="h-4 w-4" /> Résilier</Button>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel title="Échéancier" description="Un appel de loyer par mois, émis automatiquement chaque matin. La quittance se télécharge une fois le mois payé." className="min-w-0" bodyClassName="p-0">
          {!calls.length ? <p className="p-5 text-sm text-muted-foreground">Aucun appel de loyer pour l'instant : le premier sera émis au début du mois de {formatDate(lease.billing_start, "MMMM yyyy")}.</p> : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Mois</TableHead>
                  <TableHead className="hidden md:table-cell">Facture</TableHead>
                  <TableHead className="hidden sm:table-cell">Échéance</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead className="text-right">Reste</TableHead>
                  <TableHead>État</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls.map((call) => (
                  <TableRow key={call.id}>
                    <TableCell className="font-medium first-letter:uppercase">{formatDate(call.period, "MMMM yyyy")}</TableCell>
                    <TableCell className="hidden md:table-cell"><Link className="text-primary hover:underline" to={`/admin/factures/${call.invoice.id}`}>{call.invoice.number ?? "Brouillon"}</Link></TableCell>
                    <TableCell className={cn("hidden text-sm sm:table-cell", call.invoice.is_overdue ? "font-medium text-red-600" : "text-muted-foreground")}>{formatDate(call.invoice.due_date)}</TableCell>
                    <TableCell className="text-right tabular-nums">{cfa(call.invoice.total)}</TableCell>
                    <TableCell className="text-right tabular-nums">{call.invoice.balance > 0 ? cfa(call.invoice.balance) : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell><InvoiceStateBadge invoice={{ status: call.invoice.status as Invoice["status"], payment_state: call.invoice.payment_state as Invoice["payment_state"], is_overdue: call.invoice.is_overdue, type: { value: "facture", label: "Facture" } }} /></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {call.invoice.balance > 0 && (
                          <Button asChild size="sm" variant="outline"><Link to={`/admin/factures/${call.invoice.id}`}>Encaisser</Link></Button>
                        )}
                        {call.can_quittance && (
                          <Button size="icon" variant="ghost" className="h-8 w-8" title="Quittance" aria-label={`Quittance ${call.period}`}
                            onClick={() => downloadFile(`/leases/${lease.id}/rent-calls/${call.id}/quittance`, `quittance-${lease.reference}-${call.period.slice(0, 7)}.pdf`)}>
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>

        <aside className="space-y-4">
          <Panel title="Situation">
            <AmountRow label="Arriérés" value={lease.arrears ?? 0} strong tone={lease.arrears ? "red" : "green"} />
            <p className="text-xs text-muted-foreground">{lease.months_overdue ? `${lease.months_overdue} mois échu(s) non payé(s)` : "Aucun loyer échu impayé."} · {paidMonths} mois payé(s)</p>
          </Panel>
          <Panel title="Conditions">
            <AmountRow label="Loyer" value={lease.rent} tone="muted" />
            <AmountRow label="Charges" value={lease.charges} tone="muted" />
            <AmountRow label="Total mensuel" value={lease.rent + lease.charges} strong />
            <dl className="mt-3 space-y-1.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Échéance</dt><dd>le {lease.due_day} du mois</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Entrée</dt><dd>{formatDate(lease.start_date)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Fin prévue</dt><dd>{formatDate(lease.end_date)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Caution</dt><dd className="tabular-nums">{cfa(lease.deposit)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Avance</dt><dd>{lease.advance_months} mois</dd></div>
              {lease.managed && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Commission</dt><dd>{lease.commission_rate} %</dd></div>}
              {lease.agent && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Agent</dt><dd>{lease.agent.name}</dd></div>}
            </dl>
          </Panel>
          <InspectionsPanel lease={lease} />
          <DepositPanel lease={lease} />
          {lease.entry_invoice && (
            <Panel title="Facture d'entrée">
              <Link to={`/admin/factures/${lease.entry_invoice.id}`} className="flex items-center justify-between gap-2 text-sm hover:underline">
                <span className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" />{lease.entry_invoice.number ?? "Brouillon à émettre"}</span>
                <span className="tabular-nums">{cfa(lease.entry_invoice.total)}</span>
              </Link>
              {lease.entry_invoice.balance > 0 && <p className="mt-1 text-xs text-amber-700">Reste {cfa(lease.entry_invoice.balance)}</p>}
            </Panel>
          )}
          {lease.notes && <Panel title="Notes"><p className="whitespace-pre-line text-sm">{lease.notes}</p></Panel>}
          <Panel title="Documents">
            <p className="flex items-start gap-2 text-sm text-muted-foreground"><Receipt className="mt-0.5 h-4 w-4 shrink-0" /> Quittance de chaque mois payé dans l'échéancier ; reçu de chaque encaissement depuis sa facture ; états des lieux et décompte de caution à imprimer depuis leurs encarts.</p>
          </Panel>
        </aside>
      </div>

      {editing && <EditLeaseDialog lease={lease} onClose={() => setEditing(false)} />}
      {terminating && <TerminateDialog lease={lease} onClose={() => setTerminating(false)} />}
    </>
  );
}

function EditLeaseDialog({ lease, onClose }: { lease: Lease; onClose: () => void }) {
  const [form, setForm] = useState({
    rent: lease.rent as number | "", charges: lease.charges as number | "", due_day: lease.due_day,
    end_date: lease.end_date ?? "", managed: lease.managed, commission_rate: lease.commission_rate, notes: lease.notes ?? "",
  });
  const mutation = useApiMutation(() => api(`/leases/${lease.id}`, {
    method: "PUT",
    body: { ...form, rent: form.rent || 0, charges: form.charges || 0, end_date: form.end_date || null, notes: form.notes || null },
  }), { success: "Bail modifié : les prochains appels de loyer en tiennent compte.", invalidate: [["lease", String(lease.id)], ["leases"]], onSuccess: onClose });
  const err = (f: string) => mutation.error?.field(f);
  const submit = (e: FormEvent) => { e.preventDefault(); mutation.mutate(undefined); };
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Modifier le bail</DialogTitle>
            <DialogDescription>Les appels déjà émis ne changent pas ; les suivants prennent les nouveaux montants.</DialogDescription>
          </DialogHeader>
          <FormError message={err("lease")} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Loyer" error={err("rent")}><MoneyInput value={form.rent} onChange={(rent) => setForm({ ...form, rent })} /></Field>
            <Field label="Charges" error={err("charges")}><MoneyInput value={form.charges} onChange={(charges) => setForm({ ...form, charges })} /></Field>
            <Field label="Jour d'échéance" htmlFor="edit-due" error={err("due_day")}>
              <Input id="edit-due" type="number" min={1} max={28} value={form.due_day} onChange={(e) => setForm({ ...form, due_day: Number(e.target.value) })} />
            </Field>
            <Field label="Fin prévue" htmlFor="edit-end" error={err("end_date")}>
              <Input id="edit-end" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </Field>
          </div>
          <label className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
            <span className="text-sm font-medium">En gestion (reversement au propriétaire)</span>
            <Switch checked={form.managed} onCheckedChange={(managed) => setForm({ ...form, managed })} />
          </label>
          {form.managed && (
            <Field label="Commission (%)" htmlFor="edit-commission" error={err("commission_rate") ?? err("owner_id")}>
              <Input id="edit-commission" type="number" min={0} max={100} step="0.5" value={form.commission_rate} onChange={(e) => setForm({ ...form, commission_rate: Number(e.target.value) })} />
            </Field>
          )}
          <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={mutation.isPending}>Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TerminateDialog({ lease, onClose }: { lease: Lease; onClose: () => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const mutation = useApiMutation(() => api(`/leases/${lease.id}/terminate`, { method: "POST", body: { terminated_on: date, reason } }), {
    success: "Bail résilié. Pensez à l'état des lieux, à la caution et à remettre le bien en location.",
    invalidate: [["lease", String(lease.id)], ["leases"]], onSuccess: onClose,
  });
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Résilier le bail</DialogTitle>
          <DialogDescription>Plus aucun appel de loyer après le mois de fin. Les loyers déjà dus restent à encaisser.</DialogDescription>
        </DialogHeader>
        <FormError message={mutation.error?.field("lease")} />
        <Field label="Date de fin" htmlFor="term-date" error={mutation.error?.field("terminated_on")}>
          <Input id="term-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Motif" htmlFor="term-reason" error={mutation.error?.field("reason")}>
          <Textarea id="term-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. départ du locataire, préavis reçu le…" />
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="destructive" disabled={mutation.isPending} onClick={() => mutation.mutate(undefined)}>Résilier</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
