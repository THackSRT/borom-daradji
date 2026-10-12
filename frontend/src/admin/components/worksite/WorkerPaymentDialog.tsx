import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useApiMutation } from "../../hooks";
import { cfa, MethodPicker, MoneyInput, referenceHint } from "../billing";
import { Field, FormError } from "../ui";
import { cn } from "@/lib/utils";

interface Props {
  worker: { id: number; name: string; balance?: number };
  /** Chantier d'où l'on paie : propose la caisse du chantier. */
  worksite?: { id: number; reference: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Avance ou paiement d'un tâcheron, éventuellement avec la caisse du chantier. */
export function WorkerPaymentDialog({ worker, worksite, open, onOpenChange }: Props) {
  const due = Math.max(0, worker.balance ?? 0);
  const [kind, setKind] = useState<"avance" | "paiement">(due > 0 ? "paiement" : "avance");
  const [amount, setAmount] = useState<number | "">(due || "");
  const [method, setMethod] = useState("especes");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [fromSiteCash, setFromSiteCash] = useState(!!worksite);

  const mutation = useApiMutation(() => api(`/workers/${worker.id}/payments`, {
    method: "POST",
    body: {
      kind, amount: amount || 0, method, reference: reference || null, note: note || null,
      worksite_id: worksite?.id ?? null, from_site_cash: !!worksite && fromSiteCash && method === "especes",
    },
  }), {
    success: kind === "avance" ? "Avance enregistrée." : "Paiement enregistré.",
    invalidate: [["worker", String(worker.id)], ["workers"], ...(worksite ? [["worksite-team", worksite.id], ["worksite-cash", worksite.id], ["worksite-budget", worksite.id]] : [])],
    onSuccess: () => onOpenChange(false),
  });
  const err = (f: string) => mutation.error?.field(f);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Payer {worker.name}</DialogTitle>
          <DialogDescription>{due > 0 ? `Reste dû : ${cfa(due)}.` : (worker.balance ?? 0) < 0 ? `Avance non couverte : ${cfa(-(worker.balance ?? 0))}.` : "Rien n'est dû pour l'instant : une avance est possible."}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {(["paiement", "avance"] as const).map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)}
              className={cn("rounded-lg border px-3 py-2 text-sm font-medium", kind === k ? "border-primary bg-primary/5 text-primary ring-1 ring-primary" : "hover:bg-muted")}>
              {k === "paiement" ? "Paiement du travail fait" : "Avance"}
            </button>
          ))}
        </div>
        <Field label="Montant" error={err("amount")}><MoneyInput value={amount} onChange={setAmount} autoFocus /></Field>
        <MethodPicker value={method} onChange={setMethod} error={err("method")} />
        {method !== "especes" && (
          <Field label="Référence" error={err("reference")} hint={referenceHint(method)}><Input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
        )}
        {worksite && method === "especes" && (
          <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
            <span>Payé avec la caisse du chantier {worksite.reference}</span>
            <Switch checked={fromSiteCash} onCheckedChange={setFromSiteCash} />
          </label>
        )}
        <Field label="Note (facultatif)"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <FormError message={err("worksite_id")} />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => mutation.mutate(undefined)} disabled={!amount || mutation.isPending}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Annulation avec motif (paiement, mouvement de caisse) : rien n'est supprimé. */
export function ReasonDialog({ title, description, open, onOpenChange, onConfirm, pending, error }: {
  title: string;
  description?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  pending?: boolean;
  error?: string | null;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <Field label="Motif" error={error ?? undefined}><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></Field>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Retour</Button>
          <Button variant="destructive" disabled={!reason.trim() || pending} onClick={() => onConfirm(reason.trim())}>Annuler l'opération</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
