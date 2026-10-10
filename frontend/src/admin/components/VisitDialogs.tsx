import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { formatDateTime, toDateTimeInput } from "@/lib/format";
import { useApiMutation, useOptions } from "../hooks";
import type { Client, Paginated, Property, Visit } from "../types";
import { Field, FormError } from "./ui";

/** Planifier une visite : le client est connu, on cherche le bien (ou l'inverse). */
export function PlanVisitDialog({
  open,
  onOpenChange,
  client,
  property,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: { id: number; name: string };
  property?: { id: number; reference: string; title: string };
}) {
  const [search, setSearch] = useState("");
  const [targetId, setTargetId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const lookingFor = client ? "property" : "client";
  const { data: options } = useQuery({
    queryKey: ["visit-target", lookingFor, search],
    queryFn: () =>
      lookingFor === "property"
        ? api<Paginated<Property>>("/properties", { query: { search } }).then((r) => r.data.map((p) => ({ id: p.id, label: `${p.reference} · ${p.title}` })))
        : api<Paginated<Client>>("/clients", { query: { search } }).then((r) => r.data.map((c) => ({ id: c.id, label: `${c.name} · ${c.phone ?? ""}` }))),
    enabled: open,
  });

  const mutation = useApiMutation(
    () =>
      api("/visits", {
        method: "POST",
        body: {
          property_id: property?.id ?? Number(targetId),
          client_id: client?.id ?? Number(targetId),
          scheduled_at: scheduledAt,
        },
      }),
    {
      success: "Visite planifiée. Pensez à la confirmer par WhatsApp.",
      invalidate: [["visits"], ["client"], ["property"]],
      onSuccess: () => { setTargetId(""); setScheduledAt(""); onOpenChange(false); },
    },
  );

  const submit = (e: FormEvent) => { e.preventDefault(); mutation.mutate(undefined); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Planifier une visite</DialogTitle>
          <DialogDescription>{client ? `Pour ${client.name}` : `Du bien ${property?.reference}`}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label={lookingFor === "property" ? "Bien" : "Client"} htmlFor="target"
            error={mutation.error?.field("property_id") ?? mutation.error?.field("client_id")}>
            <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-2" />
            <Select value={targetId} onValueChange={setTargetId}>
              <SelectTrigger id="target"><SelectValue placeholder="Choisir" /></SelectTrigger>
              <SelectContent>{options?.map((o) => <SelectItem key={o.id} value={String(o.id)}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Date et heure" htmlFor="scheduled_at" error={mutation.error?.field("scheduled_at")}>
            <Input id="scheduled_at" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} required />
          </Field>
          <DialogFooter>
            <Button type="submit" variant="gold" disabled={!targetId || mutation.isPending}>Planifier</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Compte-rendu, report ou annulation d'une visite. */
export function VisitReportDialog({ visit, onClose }: { visit: Visit; onClose: () => void }) {
  const statuses = useOptions("visit_statuses");
  const feedbacks = useOptions("visit_feedbacks");
  const [form, setForm] = useState<{ status: string; feedback: string; notes: string; next_action: string; scheduled_at: string }>({
    status: visit.status.value === "planifiee" ? "effectuee" : visit.status.value,
    feedback: visit.feedback?.value ?? "",
    notes: visit.notes ?? "",
    next_action: visit.next_action ?? "",
    scheduled_at: toDateTimeInput(visit.scheduled_at),
  });

  const mutation = useApiMutation(
    () =>
      api(`/visits/${visit.id}`, {
        method: "PUT",
        body: {
          status: form.status,
          feedback: form.status === "effectuee" ? form.feedback || null : null,
          notes: form.notes || null,
          next_action: form.next_action || null,
          scheduled_at: form.scheduled_at,
        },
      }),
    { success: "Visite mise à jour.", invalidate: [["visits"], ["client"], ["tasks"]], onSuccess: onClose },
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Visite de {visit.property?.reference}</DialogTitle>
          <DialogDescription>{visit.client?.name} · {formatDateTime(visit.scheduled_at)}</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(undefined); }} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Statut" htmlFor="v-status">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger id="v-status"><SelectValue /></SelectTrigger>
                <SelectContent>{statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            {form.status === "planifiee" ? (
              <Field label="Nouvelle date" htmlFor="v-date" error={mutation.error?.field("scheduled_at")}>
                <Input id="v-date" type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
              </Field>
            ) : form.status === "effectuee" && (
              <Field label="Retour du prospect" htmlFor="v-feedback" error={mutation.error?.field("feedback")}>
                <Select value={form.feedback} onValueChange={(v) => setForm({ ...form, feedback: v })}>
                  <SelectTrigger id="v-feedback"><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>{feedbacks.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            )}
          </div>
          <Field label="Notes" htmlFor="v-notes">
            <Textarea id="v-notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <Field label="Prochaine action" htmlFor="v-next" hint="Devient une tâche pour demain.">
            <Input id="v-next" placeholder="Organiser une 2e visite" value={form.next_action} onChange={(e) => setForm({ ...form, next_action: e.target.value })} />
          </Field>
          <FormError message={mutation.error?.status === 422 && !mutation.error.field("feedback") ? mutation.error.message : null} />
          <DialogFooter><Button type="submit" variant="gold" disabled={mutation.isPending}>Enregistrer</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
