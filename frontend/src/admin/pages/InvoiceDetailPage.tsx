import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Ban, Download, FileMinus, Paperclip, Pencil, Receipt, Send, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api, downloadFile } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApiMutation } from "../hooks";
import type { Invoice, Payment } from "../types";
import { AmountRow, cfa, InvoiceStateBadge, PaymentDialog } from "../components/billing";
import { EmptyState, Field, FormError, LoadingBlock, Panel, ProgressBar, StatusBadge, WhatsAppLink } from "../components/ui";

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState<Payment | null>(null);

  const { data: invoice, isLoading, isError } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => api<{ data: Invoice }>(`/invoices/${id}`).then((r) => r.data),
  });

  const invalidate = [["invoice", id], ["invoices"]];
  const issue = useApiMutation(() => api(`/invoices/${id}/issue`, { method: "POST" }), { success: "Facture émise : numéro attribué.", invalidate });
  const remove = useApiMutation(() => api(`/invoices/${id}`, { method: "DELETE" }), {
    success: "Brouillon supprimé.", invalidate: [["invoices"]], onSuccess: () => navigate("/admin/factures"),
  });
  const credit = useApiMutation(() => api<{ data: Invoice }>(`/invoices/${id}/credit-notes`, { method: "POST" }), {
    invalidate, onSuccess: (r) => navigate(`/admin/factures/${r.data.id}/modifier`),
  });

  if (isLoading) return <LoadingBlock />;
  if (isError || !invoice) return <EmptyState title="Facture introuvable" action={<Button asChild variant="outline"><Link to="/admin/factures">Retour aux factures</Link></Button>} />;

  const isDraft = invoice.status.value === "brouillon";
  const isCredit = invoice.type.value === "avoir";
  const label = isCredit ? "Avoir" : "Facture";
  const fileName = `${invoice.number ?? `brouillon-${invoice.id}`}.pdf`;
  const actionError = issue.error?.field("invoice") ?? credit.error?.field("invoice") ?? remove.error?.field("invoice");

  return (
    <>
      <Link to="/admin/factures" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Factures</Link>

      <section className="mb-6 rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{label} {invoice.number ?? <span className="text-muted-foreground">(brouillon)</span>}</h1>
              <InvoiceStateBadge invoice={invoice} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              <Link to={`/admin/clients/${invoice.client.id}`} className="font-medium text-foreground hover:underline">{invoice.client.name}</Link>
              {" · "}{invoice.activity.label}
              {invoice.issue_date && <> · émise le {formatDate(invoice.issue_date)}</>}
              {invoice.due_date && <> · <span className={cn(invoice.is_overdue && "font-medium text-red-600")}>échéance {formatDate(invoice.due_date)}</span></>}
            </p>
            {invoice.credited_invoice && (
              <p className="mt-1 text-sm">Corrige la facture <Link className="font-medium text-primary hover:underline" to={`/admin/factures/${invoice.credited_invoice.id}`}>{invoice.credited_invoice.number}</Link></p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {invoice.can.pay && <Button onClick={() => setPaying(true)}><Wallet className="h-4 w-4" /> Encaisser</Button>}
            {invoice.can.issue && (
              <Button onClick={() => window.confirm(`Émettre ${isCredit ? "cet avoir" : "cette facture"} de ${cfa(invoice.total)} ? Elle ne pourra plus être modifiée.`) && issue.mutate(undefined)} disabled={issue.isPending}>
                <Send className="h-4 w-4" /> Émettre
              </Button>
            )}
            {invoice.can.update && <Button asChild variant="outline"><Link to={`/admin/factures/${invoice.id}/modifier`}><Pencil className="h-4 w-4" /> Modifier</Link></Button>}
            <Button variant="outline" onClick={() => downloadFile(`/invoices/${invoice.id}/pdf`, fileName)}><Download className="h-4 w-4" /> PDF</Button>
            <WhatsAppLink url={invoice.whatsapp_reminder_url} label="Relancer" />
            {invoice.can.credit && (
              <Button variant="outline" disabled={credit.isPending}
                onClick={() => window.confirm("Préparer un avoir ? Il reprend les lignes de la facture ; vous pourrez les ajuster avant de l'émettre.") && credit.mutate(undefined)}>
                <FileMinus className="h-4 w-4" /> Faire un avoir
              </Button>
            )}
            {invoice.can.delete && (
              <Button variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => window.confirm("Supprimer ce brouillon ?") && remove.mutate(undefined)}>
                <Trash2 className="h-4 w-4" /> Supprimer
              </Button>
            )}
          </div>
        </div>
        {actionError && <div className="mt-3"><FormError message={actionError} /></div>}
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Le document, tel qu'il sera imprimé. */}
        <Panel title="Détail" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">Désignation</th>
                  <th className="px-3 py-2.5 text-right font-medium">Qté</th>
                  <th className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">Prix unitaire</th>
                  <th className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">TVA</th>
                  <th className="px-5 py-2.5 text-right font-medium">Montant HT</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lines?.map((line) => (
                  <tr key={line.id} className="border-b last:border-0">
                    <td className="px-5 py-3">{line.description}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{line.quantity} {line.unit}</td>
                    <td className="hidden whitespace-nowrap px-3 py-3 text-right tabular-nums sm:table-cell">{cfa(line.unit_price)}</td>
                    <td className="hidden whitespace-nowrap px-3 py-3 text-right tabular-nums sm:table-cell">{line.vat_rate} %</td>
                    <td className="whitespace-nowrap px-5 py-3 text-right font-medium tabular-nums">{cfa(line.amount ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end border-t p-5">
            <div className="w-full max-w-xs">
              <AmountRow label="Total HT" value={invoice.subtotal} tone="muted" />
              <AmountRow label="TVA" value={invoice.vat_total} tone="muted" />
              <div className="my-1.5 border-t" />
              <AmountRow label="Total TTC" value={invoice.total} strong />
            </div>
          </div>
          {invoice.notes && <p className="whitespace-pre-line border-t px-5 py-4 text-sm text-muted-foreground">{invoice.notes}</p>}
        </Panel>

        <aside className="space-y-4">
          {!isDraft && !isCredit && (
            <Panel title="Règlement">
              <ProgressBar value={invoice.paid_total + invoice.credited_total} total={invoice.total} className="mb-3"
                label={`${invoice.total ? Math.min(100, Math.round(((invoice.paid_total + invoice.credited_total) / invoice.total) * 100)) : 0} % réglé`} />
              <AmountRow label="Total" value={invoice.total} tone="muted" />
              {invoice.credited_total > 0 && <AmountRow label="Avoirs" value={-invoice.credited_total} tone="muted" />}
              <AmountRow label="Encaissé" value={invoice.paid_total} tone="green" />
              <div className="my-1.5 border-t" />
              <AmountRow label={invoice.balance < 0 ? "Trop-perçu à rembourser" : "Reste à payer"} value={Math.abs(invoice.balance)} strong tone={invoice.balance > 0 && invoice.is_overdue ? "red" : undefined} />
              {invoice.can.pay && <Button className="mt-3 w-full" onClick={() => setPaying(true)}><Wallet className="h-4 w-4" /> Encaisser</Button>}
            </Panel>
          )}

          {!isCredit && !isDraft && (
            <Panel title="Encaissements" description="Chaque encaissement a son reçu.">
              {!invoice.payments?.length ? <p className="text-sm text-muted-foreground">Aucun encaissement pour l'instant.</p> : (
                <ul className="divide-y">
                  {invoice.payments.map((p) => (
                    <li key={p.id} className={cn("py-3 first:pt-0 last:pb-0", p.cancelled_at && "opacity-60")}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className={cn("font-medium tabular-nums", p.cancelled_at && "line-through")}>{cfa(p.amount)}</p>
                          <p className="text-xs text-muted-foreground">{p.method.label} · {formatDate(p.paid_on)}{p.received_by && ` · ${p.received_by.name}`}</p>
                          {p.reference && <p className="text-xs text-muted-foreground">Réf. {p.reference}</p>}
                          {p.cancelled_at && <p className="mt-1 text-xs text-red-600">Annulé : {p.cancel_reason}</p>}
                        </div>
                        <div className="flex shrink-0">
                          <Button size="icon" variant="ghost" className="h-8 w-8" title={`Reçu ${p.number}`} aria-label={`Reçu ${p.number}`}
                            onClick={() => downloadFile(`/payments/${p.id}/receipt`, `${p.number}.pdf`)}><Receipt className="h-4 w-4" /></Button>
                          {p.has_proof && (
                            <Button size="icon" variant="ghost" className="h-8 w-8" title="Justificatif" aria-label="Justificatif"
                              onClick={() => downloadFile(`/payments/${p.id}/proof`, `justificatif-${p.number}`)}><Paperclip className="h-4 w-4" /></Button>
                          )}
                          {invoice.can.cancel_payment && !p.cancelled_at && (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" title="Annuler l'encaissement" aria-label="Annuler l'encaissement"
                              onClick={() => setCancelling(p)}><Ban className="h-4 w-4" /></Button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {!!invoice.credit_notes?.length && (
            <Panel title="Avoirs">
              <ul className="space-y-2 text-sm">
                {invoice.credit_notes.map((n) => (
                  <li key={n.id} className="flex items-center justify-between gap-2">
                    <Link to={`/admin/factures/${n.id}`} className="font-medium text-primary hover:underline">{n.number ?? "Brouillon"}</Link>
                    <span className="flex items-center gap-2"><StatusBadge option={n.status} /><span className="tabular-nums">{cfa(n.total)}</span></span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {invoice.property && (
            <Panel title="Bien concerné">
              <Link to={`/admin/biens/${invoice.property.id}`} className="text-sm font-medium text-primary hover:underline">{invoice.property.reference}</Link>
              <p className="text-sm text-muted-foreground">{invoice.property.title}</p>
            </Panel>
          )}
        </aside>
      </div>

      {invoice.can.pay && <PaymentDialog invoice={invoice} open={paying} onOpenChange={setPaying} />}
      <CancelPaymentDialog payment={cancelling} invoiceId={invoice.id} onClose={() => setCancelling(null)} />
    </>
  );
}

function CancelPaymentDialog({ payment, invoiceId, onClose }: { payment: Payment | null; invoiceId: number; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const mutation = useApiMutation(() => api(`/payments/${payment!.id}/cancel`, { method: "POST", body: { reason } }), {
    success: "Encaissement annulé.",
    invalidate: [["invoice", String(invoiceId)], ["invoices"], ["cash-session"], ["payments"]],
    onSuccess: () => { setReason(""); onClose(); },
  });
  return (
    <Dialog open={!!payment} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Annuler l'encaissement {payment?.number}</DialogTitle>
          <DialogDescription>{payment && `${cfa(payment.amount)} · ${payment.method.label}`}. L'encaissement reste visible, barré, avec le motif.</DialogDescription>
        </DialogHeader>
        <FormError message={mutation.error?.field("payment")} />
        <Field label="Motif" htmlFor="cancel-reason" error={mutation.error?.field("reason")}>
          <Textarea id="cancel-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. saisi deux fois" />
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Retour</Button>
          <Button variant="destructive" disabled={mutation.isPending} onClick={() => mutation.mutate(undefined)}>Annuler l'encaissement</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
