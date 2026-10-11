/**
 * Fin de bail : états des lieux et restitution de la caution (encarts de la fiche du bail).
 */
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronRight, ClipboardList, Download, Plus, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api, downloadFile } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApiMutation } from "../hooks";
import type { DepositInfo, Lease, LeaseInspection } from "../types";
import { AmountRow, cfa, MethodPicker, MoneyInput, referenceHint } from "./billing";
import { Field, FormError, Panel } from "./ui";

export function InspectionsPanel({ lease }: { lease: Lease }) {
  const navigate = useNavigate();
  const create = useApiMutation((type: string) => api<{ data: LeaseInspection }>(`/leases/${lease.id}/inspections`, { method: "POST", body: { type } }), {
    invalidate: [["lease", String(lease.id)]],
    onSuccess: (r) => navigate(`/admin/etats-des-lieux/${r.data.id}`),
  });
  const types = [
    { value: "entree", label: "Entrée", hint: "À faire à la remise des clés." },
    { value: "sortie", label: "Sortie", hint: "Au départ du locataire : comparé à l'entrée." },
  ];

  return (
    <Panel title="États des lieux">
      <div className="space-y-2">
        {types.map((type) => {
          const inspection = lease.inspections?.find((i) => i.type.value === type.value);
          if (inspection) {
            return (
              <Link key={type.value} to={`/admin/etats-des-lieux/${inspection.id}`} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm hover:bg-muted/50">
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 font-medium">
                    {inspection.validated_at ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <ClipboardList className="h-4 w-4 text-amber-600" />}
                    {type.label} · {formatDate(inspection.inspected_on)}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {inspection.validated_at ? "Validé" : `En cours : ${inspection.rated_count}/${inspection.items_count} notés`} · {inspection.photos_count} photo{inspection.photos_count > 1 ? "s" : ""}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            );
          }
          return (
            <div key={type.value} className="flex items-center justify-between gap-2 rounded-lg border border-dashed px-3 py-2.5">
              <span className="min-w-0 text-sm"><span className="font-medium">{type.label}</span><span className="block text-xs text-muted-foreground">{type.hint}</span></span>
              {lease.can?.inspect && (
                <Button size="sm" variant="outline" disabled={create.isPending} onClick={() => create.mutate(type.value)}>Commencer</Button>
              )}
            </div>
          );
        })}
        <FormError message={create.error?.field("type")} />
      </div>
    </Panel>
  );
}

export function DepositPanel({ lease }: { lease: Lease }) {
  const [settling, setSettling] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const active = lease.status.value === "actif";
  const { data: info } = useQuery({
    queryKey: ["lease-deposit", lease.id],
    queryFn: () => api<{ data: DepositInfo }>(`/leases/${lease.id}/deposit`).then((r) => r.data),
    enabled: !active || !!lease.deposit_settlement,
  });
  const settlement = info?.settlement;

  return (
    <Panel title="Caution" action={settlement && (
      <Button size="sm" variant="ghost" onClick={() => downloadFile(`/leases/${lease.id}/deposit/pdf`, `${settlement.number}.pdf`)}><Download className="h-4 w-4" /> PDF</Button>
    )}>
      {active && !lease.deposit_settlement ? (
        <>
          <AmountRow label="Prévue au bail" value={lease.deposit} />
          <p className="text-xs text-muted-foreground">Se restitue après la résiliation, au vu de l'état des lieux de sortie.</p>
        </>
      ) : !info ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : settlement ? (
        <>
          <AmountRow label="Caution encaissée" value={settlement.deposit_held} tone="muted" />
          {settlement.arrears_retained > 0 && <AmountRow label="Loyers retenus" value={-settlement.arrears_retained} tone="muted" />}
          {settlement.deductions.map((d, i) => <AmountRow key={i} label={d.label} value={-d.amount} tone="muted" />)}
          <AmountRow label="Rendu au locataire" value={settlement.refund} strong tone="green" />
          {settlement.balance_due > 0 && (
            <AmountRow label="Reste dû" value={settlement.balance_due} strong tone="red">
              {settlement.balance_invoice && <Link to={`/admin/factures/${settlement.balance_invoice.id}`} className="ml-1.5 text-xs font-normal text-primary hover:underline">{settlement.balance_invoice.number ?? "facture à émettre"}</Link>}
            </AmountRow>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {settlement.number} · {formatDate(settlement.settled_on)}{settlement.refund_method && ` · ${settlement.refund_method.label}`}{settlement.refund_reference && ` (${settlement.refund_reference})`}
          </p>
          {info.can_cancel && (
            <button type="button" className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline" onClick={() => setCancelling(true)}>
              Annuler cette restitution
            </button>
          )}
        </>
      ) : (
        <>
          <AmountRow label="Caution encaissée" value={info.deposit_collected} />
          {info.deposit_collected !== info.deposit && <p className="text-xs text-muted-foreground">Prévue au bail : {cfa(info.deposit)}</p>}
          <AmountRow label="Loyers impayés" value={info.arrears_total} tone={info.arrears_total ? "red" : "muted"} />
          <p className="mt-1 text-xs text-muted-foreground">
            {!info.exit_inspection ? "Pas encore d'état des lieux de sortie." : info.exit_inspection.validated
              ? `État des lieux de sortie validé : ${info.exit_inspection.degradations.length} dégradation(s).`
              : "État des lieux de sortie en cours : à valider avant de restituer."}
          </p>
          {info.can_settle && <Button className="mt-3 w-full" onClick={() => setSettling(true)}><Undo2 className="h-4 w-4" /> Restituer la caution</Button>}
        </>
      )}
      {info?.cancelled.map((c) => (
        <p key={c.id} className="mt-2 border-t pt-2 text-xs text-muted-foreground">{c.number} annulée le {formatDate(c.cancelled_at)} : {c.cancel_reason}</p>
      ))}
      {settling && info && <SettlementDialog lease={lease} info={info} onClose={() => setSettling(false)} />}
      {cancelling && settlement && <CancelSettlementDialog lease={lease} number={settlement.number} onClose={() => setCancelling(false)} />}
    </Panel>
  );
}

function SettlementDialog({ lease, info, onClose }: { lease: Lease; info: DepositInfo; onClose: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [held, setHeld] = useState<number | "">(info.deposit_collected);
  const [retainArrears, setRetainArrears] = useState(true);
  const [deductions, setDeductions] = useState<{ label: string; amount: number | "" }[]>([]);
  const [method, setMethod] = useState("especes");
  const [reference, setReference] = useState("");
  const [settledOn, setSettledOn] = useState(today);
  const [note, setNote] = useState("");

  // Même calcul que App\Services\DepositService.
  const heldAmount = Number(held || 0);
  const deductionsTotal = deductions.reduce((s, d) => s + Number(d.amount || 0), 0);
  const arrears = retainArrears ? Math.min(heldAmount, info.arrears_total) : 0;
  const covered = Math.min(heldAmount - arrears, deductionsTotal);
  const balanceDue = deductionsTotal - covered;
  const refund = heldAmount - arrears - covered;
  const suggestions = (info.exit_inspection?.degradations ?? [])
    .map((d) => `${d.room} — ${d.element} : remise en état`)
    .filter((label) => !deductions.some((d) => d.label === label));

  const mutation = useApiMutation(() => api(`/leases/${lease.id}/deposit`, {
    method: "POST",
    body: {
      deposit_held: heldAmount,
      retain_arrears: retainArrears,
      deductions: deductions.filter((d) => d.label && d.amount).map((d) => ({ label: d.label, amount: Number(d.amount) })),
      refund_method: refund > 0 ? method : null,
      refund_reference: refund > 0 && reference ? reference : null,
      settled_on: settledOn,
      note: note || null,
    },
  }), {
    success: "Caution restituée.",
    invalidate: [["lease", String(lease.id)], ["lease-deposit", lease.id], ["leases"], ["cash-session"], ["invoices"]],
    onSuccess: onClose,
  });
  const err = (f: string) => mutation.error?.field(f);
  const submit = (e: FormEvent) => { e.preventDefault(); mutation.mutate(undefined); };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Restituer la caution</DialogTitle>
            <DialogDescription>{lease.tenant.name} · {lease.property.title}</DialogDescription>
          </DialogHeader>
          <FormError message={err("lease")} />
          {!info.exit_inspection?.validated && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Aucun état des lieux de sortie validé : sans lui, les retenues pour réparations sont difficiles à justifier.</p>
          )}

          <Field label="Caution encaissée" error={err("deposit_held")} hint={held !== info.deposit ? `Prévue au bail : ${cfa(info.deposit)}` : undefined}>
            <MoneyInput value={held} onChange={setHeld} />
          </Field>

          {info.arrears_total > 0 && (
            <label className="flex items-start justify-between gap-4 rounded-lg border px-3 py-2.5">
              <span className="text-sm">
                <span className="font-medium">Retenir les loyers impayés ({cfa(info.arrears_total)})</span>
                <span className="block text-xs text-muted-foreground">{info.unpaid_calls.map((c) => c.label).join(", ")} : soldés par la caution.</span>
              </span>
              <Switch checked={retainArrears} onCheckedChange={setRetainArrears} />
            </label>
          )}

          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Réparations et autres retenues</p>
            <div className="space-y-2">
              {deductions.map((d, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={d.label} onChange={(e) => setDeductions(deductions.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} placeholder="Ex. peinture du salon" />
                  <MoneyInput className="w-36 shrink-0" value={d.amount} onChange={(amount) => setDeductions(deductions.map((x, j) => (j === i ? { ...x, amount } : x)))} />
                  <Button type="button" size="icon" variant="ghost" className="shrink-0" onClick={() => setDeductions(deductions.filter((_, j) => j !== i))} aria-label="Retirer la retenue"><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              {err("deductions.0.label") && <p className="text-xs font-medium text-destructive">{err("deductions.0.label")}</p>}
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((label) => (
                  <button key={label} type="button" onClick={() => setDeductions([...deductions, { label, amount: "" }])}
                    className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs text-orange-800 hover:bg-orange-100">+ {label}</button>
                ))}
                <button type="button" onClick={() => setDeductions([...deductions, { label: "", amount: "" }])}
                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs hover:bg-muted"><Plus className="h-3 w-3" /> Autre retenue</button>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <AmountRow label="Caution" value={heldAmount} tone="muted" />
            {arrears > 0 && <AmountRow label="Loyers retenus" value={-arrears} tone="muted" />}
            {covered > 0 && <AmountRow label="Réparations retenues" value={-covered} tone="muted" />}
            <AmountRow label="À rendre au locataire" value={refund} strong tone="green" />
            {balanceDue > 0 && <AmountRow label="Reste dû, facturé au locataire" value={balanceDue} strong tone="red" />}
          </div>

          {refund > 0 && (
            <>
              <MethodPicker label="Rendue par" value={method} onChange={setMethod} error={err("refund_method")} />
              {method !== "especes" ? (
                <Field label="Référence" htmlFor="dep-ref" error={err("refund_reference")} hint={referenceHint(method)}>
                  <Input id="dep-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
                </Field>
              ) : <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">Les espèces sortent de votre caisse du jour.</p>}
            </>
          )}
          <div className={cn("grid gap-4", "sm:grid-cols-2")}>
            <Field label="Date" htmlFor="dep-date" error={err("settled_on")}>
              <Input id="dep-date" type="date" max={today} value={settledOn} onChange={(e) => setSettledOn(e.target.value)} />
            </Field>
          </div>
          <Field label="Note (facultatif)" htmlFor="dep-note"><Textarea id="dep-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={mutation.isPending}>{refund > 0 ? `Rendre ${cfa(refund)}` : "Enregistrer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CancelSettlementDialog({ lease, number, onClose }: { lease: Lease; number: string; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const mutation = useApiMutation(() => api(`/leases/${lease.id}/deposit/cancel`, { method: "POST", body: { reason } }), {
    success: "Restitution annulée : la caution est de nouveau à restituer.",
    invalidate: [["lease", String(lease.id)], ["lease-deposit", lease.id], ["leases"], ["cash-session"], ["invoices"]],
    onSuccess: onClose,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Annuler la restitution {number}</DialogTitle>
          <DialogDescription>
            Les loyers retenus redeviennent impayés, les espèces rendues reviennent dans la caisse (si elle n'est pas clôturée)
            et la facture de reste dû en brouillon est supprimée. Vous pourrez ensuite refaire la restitution.
          </DialogDescription>
        </DialogHeader>
        <FormError message={mutation.error?.field("settlement")} />
        <Field label="Motif" htmlFor="cancel-reason" error={mutation.error?.field("reason")}>
          <Textarea id="cancel-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. mauvais montant de caution" />
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Revenir</Button>
          <Button variant="destructive" disabled={mutation.isPending} onClick={() => mutation.mutate(undefined)}>Annuler la restitution</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
