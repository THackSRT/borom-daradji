import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Ban, Camera, Minus, Plus, Receipt, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { uuid } from "@/lib/uuid";
import { useApiMutation } from "../../hooks";
import type { SiteCash, SiteCashEntry, Worksite } from "../../types";
import { cfa, MoneyInput } from "../billing";
import { ProtectedImage } from "../ProtectedImage";
import { Field, FormError, Panel } from "../ui";
import { ReasonDialog } from "./WorkerPaymentDialog";

const today = () => new Date().toLocaleDateString("en-CA");

/** Onglet « Caisse » : argent confié au chef de chantier, dépenses sur place avec reçu, reliquat. */
export function CashTab({ worksite }: { worksite: Worksite }) {
  const [dialog, setDialog] = useState<"depense" | "approvisionnement" | "retour" | null>(null);
  const [receipt, setReceipt] = useState<SiteCashEntry | null>(null);
  const [cancelling, setCancelling] = useState<SiteCashEntry | null>(null);
  const { data: cash } = useQuery({
    queryKey: ["worksite-cash", worksite.id],
    queryFn: () => api<{ data: SiteCash }>(`/worksites/${worksite.id}/cash`).then((r) => r.data),
  });
  const keys = [["worksite-cash", worksite.id], ["worksite-budget", worksite.id], ["cash-session"]];
  const cancel = useApiMutation(({ id, reason }: { id: number; reason: string }) => api(`/worksites/${worksite.id}/cash/${id}/cancel`, { method: "POST", body: { reason } }), {
    success: "Mouvement annulé.", invalidate: keys, onSuccess: () => setCancelling(null),
  });

  if (!cash) return <Panel><p className="text-sm text-muted-foreground">Chargement…</p></Panel>;
  const open = ["planifie", "en_cours", "suspendu"].includes(worksite.status.value);
  const t = cash.totals;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Panel title="Mouvements de la caisse" bodyClassName="p-0"
        action={open && (
          <div className="flex flex-wrap justify-end gap-2">
            {cash.can.supply && <Button size="sm" variant="outline" onClick={() => setDialog("approvisionnement")}><Plus className="h-4 w-4" /> Approvisionner</Button>}
            {cash.can.supply && t.balance > 0 && <Button size="sm" variant="outline" onClick={() => setDialog("retour")}><Undo2 className="h-4 w-4" /> Reliquat</Button>}
            {cash.can.spend && <Button size="sm" onClick={() => setDialog("depense")}><Minus className="h-4 w-4" /> Dépense</Button>}
          </div>
        )}>
        {!cash.entries.length ? (
          <p className="p-5 text-sm text-muted-foreground">Aucun mouvement. L'agence approvisionne la caisse du chef de chantier, qui y note chaque dépense avec la photo du reçu.</p>
        ) : (
          <ul className="divide-y">
            {cash.entries.map((e) => {
              const cancelled = !!e.cancelled_at;
              const canCancel = !cancelled && e.kind.value !== "paiement_tacheron" && (e.kind.value === "depense" ? cash.can.spend : cash.can.supply);
              return (
                <li key={e.id} className={cn("flex items-center gap-3 px-4 py-3 text-sm", cancelled && "opacity-60")}>
                  {e.receipt_url ? (
                    <button type="button" onClick={() => setReceipt(e)} className="shrink-0" title="Voir le reçu">
                      <ProtectedImage url={e.receipt_url} className="h-10 w-10 rounded" alt="Reçu" />
                    </button>
                  ) : (
                    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded", e.signed_amount > 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600")}>
                      {e.signed_amount > 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate font-medium", cancelled && "line-through")}>{e.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {[formatDate(e.spent_on), e.category?.label ?? e.kind.label, e.from_cash_register ? "caisse du jour" : null, e.author?.name].filter(Boolean).join(" · ")}
                    </p>
                    {cancelled && <p className="text-xs text-red-600">Annulé : {e.cancel_reason}</p>}
                    {!cancelled && e.kind.value === "depense" && !e.receipt_url && cash.can.spend && <ReceiptUpload worksite={worksite} entry={e} />}
                  </div>
                  <span className={cn("shrink-0 tabular-nums", e.signed_amount < 0 ? "text-red-600" : "text-emerald-700", cancelled && "line-through")}>
                    {e.signed_amount > 0 ? "+" : ""}{cfa(e.signed_amount)}
                  </span>
                  {canCancel && <Button size="icon" variant="ghost" title="Annuler" onClick={() => setCancelling(e)}><Ban className="h-4 w-4" /></Button>}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <aside className="space-y-4">
        <Panel title="Solde de la caisse">
          <p className={cn("text-3xl font-semibold tabular-nums", t.balance < 0 && "text-red-600")}>{cfa(t.balance)}</p>
          {t.balance < 0 && <p className="mt-1 text-xs text-red-600">Le chef de chantier a avancé cette somme : à lui rembourser par un approvisionnement.</p>}
          <div className="mt-3 space-y-1 border-t pt-3 text-sm">
            <Row label="Reçu de l'agence" value={t.approvisionnement} />
            <Row label="Dépenses" value={-t.depense} />
            <Row label="Tâcherons payés" value={-t.paiement_tacheron} />
            <Row label="Rendu à l'agence" value={-t.retour} />
          </div>
          {t.missing_receipts > 0 && (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800"><Receipt className="mr-1 inline h-3.5 w-3.5" />{t.missing_receipts} dépense{t.missing_receipts > 1 ? "s" : ""} sans reçu.</p>
          )}
        </Panel>
      </aside>

      {dialog === "depense" && <ExpenseDialog worksite={worksite} categories={cash.categories} onClose={() => setDialog(null)} />}
      {(dialog === "approvisionnement" || dialog === "retour") && <SupplyDialog worksite={worksite} kind={dialog} balance={t.balance} onClose={() => setDialog(null)} />}
      {receipt?.receipt_url && (
        <Dialog open onOpenChange={(o) => !o && setReceipt(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{receipt.label}</DialogTitle><DialogDescription>{formatDate(receipt.spent_on)} · {cfa(receipt.amount)}</DialogDescription></DialogHeader>
            <ProtectedImage url={receipt.receipt_url} className="max-h-[70vh] w-full rounded object-contain" alt="Reçu" />
          </DialogContent>
        </Dialog>
      )}
      {cancelling && (
        <ReasonDialog open title={`Annuler « ${cancelling.label} »`} onOpenChange={(o) => !o && setCancelling(null)}
          description={cancelling.from_cash_register ? "Les espèces refont le chemin inverse dans votre caisse du jour." : "Le mouvement reste visible, barré, avec le motif."}
          pending={cancel.isPending} error={cancel.error?.field("entry") ?? cancel.error?.field("reason")}
          onConfirm={(reason) => cancel.mutate({ id: cancelling.id, reason })} />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span className="tabular-nums">{value === 0 ? "—" : cfa(value)}</span></div>;
}

function ReceiptUpload({ worksite, entry }: { worksite: Worksite; entry: SiteCashEntry }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  return (
    <label className={cn("mt-1 inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary hover:underline", busy && "pointer-events-none opacity-50")}>
      <Camera className="h-3.5 w-3.5" /> {busy ? "Envoi…" : "Ajouter le reçu"}
      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        setBusy(true);
        try {
          const form = new FormData();
          form.append("receipt", file);
          await api(`/worksites/${worksite.id}/cash/${entry.id}/receipt`, { method: "POST", body: form });
          toast.success("Reçu ajouté.");
          queryClient.invalidateQueries({ queryKey: ["worksite-cash", worksite.id] });
        } catch (err) {
          toast.error(err instanceof ApiError ? (err.field("receipt") ?? err.message) : "Envoi impossible.");
        } finally {
          setBusy(false);
        }
      }} />
    </label>
  );
}

function ExpenseDialog({ worksite, categories, onClose }: { worksite: Worksite; categories: { value: string; label: string }[]; onClose: () => void }) {
  const [category, setCategory] = useState("materiaux");
  const [amount, setAmount] = useState<number | "">("");
  const [label, setLabel] = useState("");
  const [date, setDate] = useState(today());
  const [file, setFile] = useState<File | null>(null);
  // Même identifiant si l'on renvoie après une erreur réseau : pas de doublon.
  const [clientUuid] = useState(uuid);
  const mutation = useApiMutation(() => {
    const form = new FormData();
    form.append("kind", "depense");
    form.append("category", category);
    form.append("amount", String(amount || 0));
    form.append("label", label);
    form.append("spent_on", date);
    form.append("client_uuid", clientUuid);
    if (file) form.append("receipt", file);
    return api(`/worksites/${worksite.id}/cash`, { method: "POST", body: form });
  }, { success: "Dépense enregistrée.", invalidate: [["worksite-cash", worksite.id], ["worksite-budget", worksite.id]], onSuccess: onClose });
  const err = (f: string) => mutation.error?.field(f);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Dépense sur le chantier</DialogTitle>
          <DialogDescription>Payée avec la caisse du chantier. Photographiez le reçu : il justifie la dépense.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button key={c.value} type="button" onClick={() => setCategory(c.value)}
              className={cn("rounded-full border px-3 py-1 text-xs font-medium", category === c.value ? "border-primary bg-primary/5 text-primary ring-1 ring-primary" : "hover:bg-muted")}>
              {c.label}
            </button>
          ))}
        </div>
        <Field label="Montant" error={err("amount")}><MoneyInput value={amount} onChange={setAmount} autoFocus /></Field>
        <Field label="Quoi ?" error={err("label")}><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="10 sacs de ciment" /></Field>
        <Field label="Date" error={err("spent_on")}><Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Reçu" error={err("receipt")}>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground hover:bg-muted">
            <Camera className="h-4 w-4" /> {file ? file.name : "Prendre ou choisir la photo du reçu"}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </Field>
        <FormError message={err("worksite") ?? err("category")} />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={() => mutation.mutate(undefined)} disabled={!amount || !label.trim() || mutation.isPending}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SupplyDialog({ worksite, kind, balance, onClose }: { worksite: Worksite; kind: "approvisionnement" | "retour"; balance: number; onClose: () => void }) {
  const supply = kind === "approvisionnement";
  const [amount, setAmount] = useState<number | "">(supply ? (balance < 0 ? -balance : "") : balance);
  const [label, setLabel] = useState("");
  const [register, setRegister] = useState(true);
  const mutation = useApiMutation(() => api(`/worksites/${worksite.id}/cash`, {
    method: "POST",
    body: { kind, amount: amount || 0, label: label || null, ...(supply ? { from_cash_register: register } : { to_cash_register: register }) },
  }), { success: supply ? "Caisse du chantier approvisionnée." : "Reliquat enregistré.", invalidate: [["worksite-cash", worksite.id], ["cash-session"]], onSuccess: onClose });
  const err = (f: string) => mutation.error?.field(f);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{supply ? "Approvisionner la caisse du chantier" : "Reliquat rendu à l'agence"}</DialogTitle>
          <DialogDescription>
            {supply ? `Argent remis à ${worksite.manager?.name ?? "au chef de chantier"} pour les achats et les tâcherons.` : `La caisse du chantier contient ${cfa(balance)}.`}
          </DialogDescription>
        </DialogHeader>
        <Field label="Montant" error={err("amount")}><MoneyInput value={amount} onChange={setAmount} autoFocus /></Field>
        <Field label="Libellé (facultatif)"><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={supply ? "Avance pour la semaine" : "Reliquat fin de chantier"} /></Field>
        <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
          <span>{supply ? "Espèces sorties de ma caisse du jour" : "Espèces remises dans ma caisse du jour"}<span className="block text-xs text-muted-foreground">Sinon : Wave, Orange Money, banque…</span></span>
          <Switch checked={register} onCheckedChange={setRegister} />
        </label>
        <FormError message={err("from_cash_register") ?? err("to_cash_register") ?? err("worksite")} />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={() => mutation.mutate(undefined)} disabled={!amount || mutation.isPending}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
