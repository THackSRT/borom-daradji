import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Ban, Phone, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApiMutation } from "../hooks";
import type { Purchase } from "../types";
import { AmountRow, cfa, MethodPicker, MoneyInput, referenceHint } from "../components/billing";
import { qty } from "../stock";
import { ReasonDialog } from "../components/worksite/WorkerPaymentDialog";
import { EmptyState, Field, LoadingBlock, Panel, StatusBadge } from "../components/ui";

/** Fiche d'un achat : marchandises entrées en stock, paiements au fournisseur, annulation. */
export default function PurchaseDetailPage() {
  const { id } = useParams();
  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState<{ kind: "purchase" } | { kind: "payment"; id: number } | null>(null);
  const { data: p, isLoading, isError } = useQuery({ queryKey: ["purchase", id], queryFn: () => api<{ data: Purchase }>(`/purchases/${id}`).then((r) => r.data) });
  const keys = [["purchase", id], ["purchases"], ["articles"], ["article"], ["cash-session"]];
  const cancel = useApiMutation((reason: string) => api(cancelling?.kind === "payment" ? `/purchases/${id}/payments/${cancelling.id}/cancel` : `/purchases/${id}/cancel`, { method: "POST", body: { reason } }), {
    success: cancelling?.kind === "payment" ? "Paiement annulé." : "Achat annulé : la marchandise est sortie du stock.", invalidate: keys, onSuccess: () => setCancelling(null),
  });

  if (isLoading) return <LoadingBlock />;
  if (isError || !p) return <EmptyState title="Achat introuvable" action={<Button asChild variant="outline"><Link to="/admin/achats">Retour aux achats</Link></Button>} />;
  const cancelled = !!p.cancelled_at;

  return (
    <>
      <Link to="/admin/achats" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Achats</Link>
      <section className="mb-6 flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{p.number}</h1>
            {cancelled ? <StatusBadge option={{ value: "annulee", label: "Annulé" }} /> : p.balance === 0 ? <StatusBadge option={{ value: "payee", label: "Payé" }} />
              : <StatusBadge option={p.is_overdue ? { value: "en_retard", label: "Échéance dépassée" } : { value: "non_payee", label: "À payer" }} />}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <Link className="font-medium text-foreground hover:underline" to={`/admin/clients/${p.supplier?.id}`}>{p.supplier?.name}</Link>
            {p.supplier_reference && ` · ${p.supplier_reference}`} · reçu le {formatDate(p.received_on)}{p.due_date && !cancelled && ` · échéance ${formatDate(p.due_date)}`}
          </p>
          {cancelled && <p className="mt-1 text-sm text-red-600">Annulé : {p.cancel_reason}</p>}
          {p.notes && <p className="mt-2 text-sm">{p.notes}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {p.supplier?.phone && <Button variant="outline" asChild><a href={`tel:${p.supplier.phone}`}><Phone className="h-4 w-4" /> Fournisseur</a></Button>}
          {!cancelled && p.balance > 0 && <Button onClick={() => setPaying(true)}><Wallet className="h-4 w-4" /> Payer</Button>}
          {!cancelled && <Button variant="outline" onClick={() => setCancelling({ kind: "purchase" })}><Ban className="h-4 w-4" /> Annuler l'achat</Button>}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel title="Marchandises" bodyClassName="p-0">
          <Table>
            <TableHeader><TableRow className="bg-muted/40"><TableHead>Article</TableHead><TableHead className="text-right">Qté</TableHead><TableHead className="hidden text-right sm:table-cell">Prix HT</TableHead><TableHead className="text-right">Montant HT</TableHead></TableRow></TableHeader>
            <TableBody>
              {p.lines?.map((l) => (
                <TableRow key={l.id}>
                  <TableCell><Link to={`/admin/stock/${l.article.id}`} className="font-medium hover:underline">{l.article.name}</Link><p className="text-xs text-muted-foreground">{l.article.reference} · TVA {l.vat_rate} %</p></TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">{qty(l.quantity)} <span className="text-xs text-muted-foreground">{l.article.unit}</span></TableCell>
                  <TableCell className="hidden whitespace-nowrap text-right tabular-nums sm:table-cell">{cfa(l.unit_cost)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">{cfa(l.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
        <aside className="space-y-4">
          <Panel title="Montants">
            <AmountRow label="Total HT" value={p.subtotal} tone="muted" />
            <AmountRow label="TVA" value={p.vat_total} tone="muted" />
            <AmountRow label="Total TTC" value={p.total} strong />
            <AmountRow label="Payé" value={p.paid_total} tone="green" />
            <AmountRow label="Reste à payer" value={p.balance} strong tone={p.balance ? "red" : undefined} />
          </Panel>
          <Panel title="Paiements" bodyClassName="p-0">
            {!p.payments?.length ? <p className="p-5 text-sm text-muted-foreground">Aucun paiement.</p> : (
              <ul className="divide-y">
                {p.payments.map((pay) => (
                  <li key={pay.id} className={cn("flex items-center gap-2 px-4 py-2.5 text-sm", pay.cancelled_at && "opacity-60")}>
                    <div className="min-w-0 flex-1">
                      <p className={cn("font-medium", pay.cancelled_at && "line-through")}>{cfa(pay.amount)} · {pay.method.label}</p>
                      <p className="truncate text-xs text-muted-foreground">{formatDate(pay.paid_on)}{pay.reference && ` · ${pay.reference}`}{pay.paid_by && ` · ${pay.paid_by.name}`}</p>
                      {pay.cancelled_at && <p className="text-xs text-red-600">Annulé : {pay.cancel_reason}</p>}
                    </div>
                    {!pay.cancelled_at && <Button size="icon" variant="ghost" title="Annuler" onClick={() => setCancelling({ kind: "payment", id: pay.id })}><Ban className="h-4 w-4" /></Button>}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </aside>
      </div>

      {paying && <PayDialog purchase={p} onClose={() => setPaying(false)} />}
      {cancelling && (
        <ReasonDialog open title={cancelling.kind === "payment" ? "Annuler ce paiement" : `Annuler l'achat ${p.number}`} onOpenChange={(o) => !o && setCancelling(null)}
          description={cancelling.kind === "payment" ? "En espèces, l'argent revient dans la caisse du jour." : "La marchandise ressort du stock à son prix d'achat. Impossible si elle est déjà sortie, ou s'il reste des paiements."}
          pending={cancel.isPending} error={cancel.error?.field("purchase") ?? cancel.error?.field("payment") ?? cancel.error?.field("reason")}
          onConfirm={(reason) => cancel.mutate(reason)} />
      )}
    </>
  );
}

function PayDialog({ purchase, onClose }: { purchase: Purchase; onClose: () => void }) {
  const [method, setMethod] = useState("especes");
  const [amount, setAmount] = useState<number | "">(purchase.balance);
  const [reference, setReference] = useState("");
  const mutation = useApiMutation(() => api(`/purchases/${purchase.id}/payments`, { method: "POST", body: { amount: amount || 0, method, reference: reference || null } }), {
    success: "Paiement enregistré.", invalidate: [["purchase", String(purchase.id)], ["purchases"], ["cash-session"]], onSuccess: onClose,
  });
  const err = (f: string) => mutation.error?.field(f);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Payer {purchase.supplier?.name}</DialogTitle><DialogDescription>Reste à payer : {cfa(purchase.balance)}. En espèces, le montant sort de votre caisse du jour.</DialogDescription></DialogHeader>
        <Field label="Montant" error={err("amount")}><MoneyInput value={amount} onChange={setAmount} autoFocus /></Field>
        <MethodPicker value={method} onChange={setMethod} error={err("method")} />
        {method !== "especes" && <Field label="Référence" error={err("reference")} hint={referenceHint(method)}><Input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={() => mutation.mutate(undefined)} disabled={!amount || mutation.isPending}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
