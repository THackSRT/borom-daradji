import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FileText, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useApiMutation } from "../../hooks";
import type { Option, Worksite } from "../../types";
import { AmountRow, cfa } from "../billing";
import { FormError, Panel, ProgressBar, StatusBadge } from "../ui";

interface Billing {
  contract_ht: number;
  contract_total: number;
  billed_work_ht: number;
  remaining_ht: number;
  deposits_ht: number;
  deposits_deducted_ht: number;
  invoiced_total: number;
  paid_total: number;
  balance: number;
  default_deposit_rate: number;
  invoices: { id: number; kind: Option; number: string | null; status: Option; issue_date: string | null; total: number; paid_total: number; balance: number }[];
  blocking_draft: { id: number; number: string | null } | null;
  can_invoice: boolean;
}

interface Preview {
  kind: string;
  sequence: number;
  lines: { description: string; unit_price: number; vat_rate: number }[];
  total_ht: number;
}

const kindLabels: Record<string, string> = { acompte: "Facture d'acompte", situation: "Situation de travaux", solde: "Facture de solde" };

/** Onglet « Factures » du chantier : acompte, situations cumulées, solde, à partir du marché et de l'avancement. */
export function BillingTab({ worksite }: { worksite: Worksite }) {
  const [kind, setKind] = useState<string | null>(null);
  const { data: billing } = useQuery({
    queryKey: ["worksite-billing", worksite.id],
    queryFn: () => api<{ data: Billing }>(`/worksites/${worksite.id}/billing`).then((r) => r.data),
  });
  if (!billing) return <Panel><p className="text-sm text-muted-foreground">Chargement…</p></Panel>;
  const open = worksite.status.value !== "facture";
  const hasWork = billing.invoices.some((i) => i.kind.value !== "acompte");

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Panel title="Factures du chantier" bodyClassName="p-0"
        action={billing.can_invoice && open && billing.contract_ht > 0 && (
          <div className="flex flex-wrap justify-end gap-2">
            {!hasWork && <Button size="sm" variant="outline" onClick={() => setKind("acompte")}>Acompte</Button>}
            <Button size="sm" variant="outline" onClick={() => setKind("situation")}>Situation</Button>
            {worksite.status.value === "termine" && <Button size="sm" onClick={() => setKind("solde")}>Solde</Button>}
          </div>
        )}>
        {billing.blocking_draft && (
          <p className="border-b bg-amber-50 px-5 py-2 text-sm text-amber-800">
            Brouillon en attente : <Link className="font-medium underline" to={`/admin/factures/${billing.blocking_draft.id}`}>vérifiez-le et émettez-le</Link> avant la facture suivante.
          </p>
        )}
        {!billing.invoices.length ? (
          <p className="p-5 text-sm text-muted-foreground">{billing.contract_ht > 0 ? "Aucune facture : commencez par l'acompte prévu au devis, puis une situation à chaque étape." : "Pas de marché : la facturation commence avec un devis accepté."}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Facture</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead className="text-right">Montant TTC</TableHead>
                <TableHead className="text-right">Reste</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {billing.invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <Link to={`/admin/factures/${inv.id}`} className="font-medium hover:underline">{inv.kind.label}</Link>
                    <p className="text-xs text-muted-foreground">{inv.number ?? <StatusBadge option={inv.status} />}</p>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{formatDate(inv.issue_date)}</TableCell>
                  <TableCell className="text-right tabular-nums">{cfa(inv.total)}</TableCell>
                  <TableCell className="text-right tabular-nums">{inv.balance > 0 ? cfa(inv.balance) : <span className="text-muted-foreground">—</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
      <aside className="space-y-4">
        <Panel title="Marché">
          <AmountRow label="Montant HT" value={billing.contract_ht} />
          <AmountRow label="Travaux facturés HT" value={billing.billed_work_ht} tone="muted" />
          <ProgressBar className="my-2" value={billing.billed_work_ht} total={billing.contract_ht || 1} label={`${billing.contract_ht ? Math.round((billing.billed_work_ht / billing.contract_ht) * 100) : 0} %`} />
          <AmountRow label="Reste à facturer HT" value={billing.remaining_ht} strong />
          {billing.deposits_ht > 0 && <p className="mt-1 text-xs text-muted-foreground">Acompte {cfa(billing.deposits_ht)} HT, dont {cfa(billing.deposits_deducted_ht)} déjà déduit des situations.</p>}
        </Panel>
        <Panel title="Encaissements">
          <AmountRow label="Facturé TTC" value={billing.invoiced_total} tone="muted" />
          <AmountRow label="Encaissé" value={billing.paid_total} tone="green" />
          <AmountRow label="Reste à encaisser" value={billing.balance} strong tone={billing.balance ? "red" : undefined} />
        </Panel>
      </aside>
      {kind && <InvoiceDialog worksite={worksite} kind={kind} defaultRate={billing.default_deposit_rate} onClose={() => setKind(null)} />}
    </div>
  );
}

function InvoiceDialog({ worksite, kind, defaultRate, onClose }: { worksite: Worksite; kind: string; defaultRate: number; onClose: () => void }) {
  const navigate = useNavigate();
  const [rate, setRate] = useState<number>(defaultRate || 30);
  const query = { kind, deposit_rate: kind === "acompte" ? rate : undefined };
  const { data: preview, error } = useQuery({
    queryKey: ["worksite-invoice-preview", worksite.id, query],
    queryFn: () => api<{ data: Preview }>(`/worksites/${worksite.id}/invoices/preview`, { query }).then((r) => r.data),
    retry: false,
  });
  const mutation = useApiMutation(() => api<{ data: { id: number } }>(`/worksites/${worksite.id}/invoices`, { method: "POST", body: query }), {
    success: "Brouillon de facture préparé : vérifiez-le et émettez-le.",
    invalidate: [["worksite-billing", worksite.id], ["worksite", String(worksite.id)], ["invoices"]],
    onSuccess: (r) => navigate(`/admin/factures/${r.data.id}`),
  });
  const apiError = error instanceof ApiError ? error : null;
  const problem = apiError?.field("kind") ?? apiError?.field("deposit_rate") ?? (error ? error.message : null);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{kindLabels[kind]}{preview?.sequence ? ` n° ${preview.sequence}` : ""}</DialogTitle>
          <DialogDescription>
            {kind === "acompte" ? "Pourcentage du marché HT, facturé avant le début des situations." : kind === "situation"
              ? "Travaux réalisés depuis la dernière situation, d'après l'avancement des lots ; l'acompte est déduit au prorata."
              : "Tous les lots à 100 % et le reste de l'acompte déduit. Le chantier passera en « facturé »."}
          </DialogDescription>
        </DialogHeader>
        {kind === "acompte" && (
          <label className="flex items-center gap-2 text-sm">Acompte <Input type="number" className="w-24" min={1} max={100} value={rate} onChange={(e) => setRate(Number(e.target.value))} /> % du marché</label>
        )}
        <FormError message={problem ?? mutation.error?.field("kind")} />
        {preview && (
          <div className="rounded-lg border">
            {preview.lines.map((line, i) => (
              <div key={i} className="flex items-start justify-between gap-3 border-b px-3 py-2 text-sm last:border-0">
                <span className="min-w-0"><FileText className="mr-1 inline h-3.5 w-3.5 text-muted-foreground" />{line.description} <span className="text-xs text-muted-foreground">· TVA {line.vat_rate} %</span></span>
                <span className={line.unit_price < 0 ? "shrink-0 tabular-nums text-red-600" : "shrink-0 tabular-nums"}>{cfa(line.unit_price)}</span>
              </div>
            ))}
            <div className="flex justify-between bg-muted/40 px-3 py-2 text-sm font-semibold"><span>Total HT</span><span className="tabular-nums">{cfa(preview.total_ht)}</span></div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={() => mutation.mutate(undefined)} disabled={!preview || mutation.isPending}><Receipt className="h-4 w-4" /> Préparer la facture</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
