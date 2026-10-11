import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Ban, Coins, HandCoins, Pencil, Phone, Scale, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApiMutation } from "../hooks";
import type { WorkerDetail, WorkerPayment } from "../types";
import { cfa } from "../components/billing";
import { EmptyState, LoadingBlock, Panel, StatCard, StatusBadge } from "../components/ui";
import { WorkerDialog } from "../components/worksite/WorkerDialog";
import { ReasonDialog, WorkerPaymentDialog } from "../components/worksite/WorkerPaymentDialog";

const taskLabels: Record<string, string> = { en_cours: "En cours", terminee: "Terminée", annulee: "Annulée" };

/** Fiche d'un tâcheron : ce qu'il a gagné (journées, tâches), ce qu'il a reçu, ce qui lui reste dû. */
export default function WorkerDetailPage() {
  const { id } = useParams();
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState<WorkerPayment | null>(null);
  const { data: worker, isLoading, isError } = useQuery({
    queryKey: ["worker", id],
    queryFn: () => api<{ data: WorkerDetail }>(`/workers/${id}`).then((r) => r.data),
  });
  const cancel = useApiMutation(({ payment, reason }: { payment: number; reason: string }) => api(`/workers/${id}/payments/${payment}/cancel`, { method: "POST", body: { reason } }), {
    success: "Paiement annulé.", invalidate: [["worker", id], ["workers"], ["worksite-cash"], ["worksite-team"]], onSuccess: () => setCancelling(null),
  });

  if (isLoading) return <LoadingBlock />;
  if (isError || !worker) return <EmptyState title="Tâcheron introuvable" action={<Button asChild variant="outline"><Link to="/admin/tacherons">Retour aux tâcherons</Link></Button>} />;
  const balance = worker.balance ?? 0;

  return (
    <>
      <Link to="/admin/tacherons" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Tâcherons</Link>
      <section className="mb-6 flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{worker.name}</h1>
            {!worker.is_active && <StatusBadge option={{ value: "annulee", label: "Désactivé" }} />}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {[worker.trade?.name, worker.pay_type.value === "journalier" ? `${cfa(worker.daily_rate)} par jour` : "À la tâche"].filter(Boolean).join(" · ")}
          </p>
          {worker.notes && <p className="mt-2 whitespace-pre-line text-sm">{worker.notes}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {worker.phone && <Button asChild variant="outline"><a href={`tel:${worker.phone}`}><Phone className="h-4 w-4" /> {worker.phone}</a></Button>}
          {worker.can.update && <Button variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Modifier</Button>}
          {worker.can.pay && <Button onClick={() => setPaying(true)}><Wallet className="h-4 w-4" /> Payer</Button>}
        </div>
      </section>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Gagné" value={cfa(worker.earned ?? 0)} hint="Journées pointées et tâches terminées" icon={Coins} />
        <StatCard label="Reçu" value={cfa(worker.paid ?? 0)} hint="Avances et paiements" icon={HandCoins} />
        <StatCard label={balance < 0 ? "Avance à couvrir" : "Reste à payer"} value={cfa(Math.abs(balance))} icon={Scale} tone={balance > 0 ? "danger" : balance < 0 ? "warning" : "success"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Chantiers" bodyClassName="p-0">
          {!worker.worksites.length ? <p className="p-5 text-sm text-muted-foreground">Pas encore passé sur un chantier.</p> : (
            <Table>
              <TableHeader><TableRow className="bg-muted/40"><TableHead>Chantier</TableHead><TableHead className="text-right">Jours</TableHead><TableHead className="text-right">Gagné</TableHead><TableHead className="text-right">Reçu</TableHead></TableRow></TableHeader>
              <TableBody>
                {worker.worksites.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell><Link to={`/admin/chantiers/${w.id}`} className="font-medium hover:underline">{w.title}</Link><p className="font-mono text-xs text-muted-foreground">{w.reference}</p></TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{w.days.toLocaleString("fr-FR")}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{cfa(w.earned)}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{cfa(w.paid)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>

        <Panel title="Avances et paiements" bodyClassName="p-0">
          {!worker.payments.length ? <p className="p-5 text-sm text-muted-foreground">Aucun paiement.</p> : (
            <ul className="divide-y">
              {worker.payments.map((p) => (
                <li key={p.id} className={cn("flex items-center gap-3 px-4 py-3 text-sm", p.cancelled_at && "opacity-60")}>
                  <div className="min-w-0 flex-1">
                    <p className={cn("font-medium", p.cancelled_at && "line-through")}>{p.kind.label} · {p.method.label}{p.reference && <span className="font-normal text-muted-foreground"> ({p.reference})</span>}</p>
                    <p className="text-xs text-muted-foreground">{[formatDate(p.paid_on), p.worksite?.reference, p.from_site_cash ? "caisse du chantier" : null, p.paid_by?.name].filter(Boolean).join(" · ")}</p>
                    {p.note && <p className="text-xs">{p.note}</p>}
                    {p.cancelled_at && <p className="text-xs text-red-600">Annulé : {p.cancel_reason}</p>}
                  </div>
                  <span className={cn("shrink-0 tabular-nums", p.cancelled_at && "line-through")}>{cfa(p.amount)}</span>
                  {worker.can.pay && !p.cancelled_at && <Button size="icon" variant="ghost" title="Annuler" onClick={() => setCancelling(p)}><Ban className="h-4 w-4" /></Button>}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Travaux à la tâche" bodyClassName="p-0">
          {!worker.tasks.length ? <p className="p-5 text-sm text-muted-foreground">Aucun.</p> : (
            <ul className="divide-y">
              {worker.tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0"><p className={cn("font-medium", t.status === "annulee" && "line-through text-muted-foreground")}>{t.description}</p><p className="text-xs text-muted-foreground">{t.worksite.reference}{t.completed_on && ` · terminée le ${formatDate(t.completed_on)}`}</p></div>
                  <div className="flex shrink-0 items-center gap-2"><span className="tabular-nums">{cfa(t.amount)}</span><StatusBadge option={{ value: t.status, label: taskLabels[t.status] ?? t.status }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Dernières journées pointées" bodyClassName="p-0">
          {!worker.attendances.length ? <p className="p-5 text-sm text-muted-foreground">Aucune.</p> : (
            <ul className="divide-y">
              {worker.attendances.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                  <span>{formatDate(a.worked_on)} <span className="text-muted-foreground">· {a.worksite.reference} · {a.days === 1 ? "journée" : "½ journée"}</span></span>
                  <span className="tabular-nums">{cfa(a.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {editing && <WorkerDialog worker={worker} onClose={() => setEditing(false)} />}
      {paying && <WorkerPaymentDialog worker={worker} open onOpenChange={setPaying} />}
      {cancelling && (
        <ReasonDialog open title={`Annuler ${cancelling.kind.label.toLowerCase()} de ${cfa(cancelling.amount)}`} onOpenChange={(o) => !o && setCancelling(null)}
          description={cancelling.from_site_cash ? "La sortie de la caisse du chantier est annulée avec." : "Le paiement reste visible, barré, avec le motif."}
          pending={cancel.isPending} error={cancel.error?.field("payment") ?? cancel.error?.field("entry") ?? cancel.error?.field("reason")}
          onConfirm={(reason) => cancel.mutate({ payment: cancelling.id, reason })} />
      )}
    </>
  );
}
