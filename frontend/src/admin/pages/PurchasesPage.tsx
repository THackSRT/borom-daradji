import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Plus, Search, ShoppingCart, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Paginated, Purchase, PurchaseSummary } from "../types";
import { cfa } from "../components/billing";
import { EmptyState, FilterChips, LoadingBlock, PageHeader, Pagination, Panel, StatCard, StatusBadge } from "../components/ui";

type State = "tous" | "a_payer" | "en_retard" | "annules";

/** Achats aux fournisseurs : bons d'entrée en stock, ce qui reste à payer. */
export default function PurchasesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [state, setState] = useState<State>("tous");
  const [page, setPage] = useState(1);
  const query = { search: search || undefined, state: state === "tous" ? undefined : state, page };
  const { data, isLoading } = useQuery({
    queryKey: ["purchases", query],
    queryFn: () => api<Paginated<Purchase> & { summary: PurchaseSummary }>("/purchases", { query }),
  });
  const summary = data?.summary;

  return (
    <>
      <PageHeader title="Achats" description="Marchandises reçues des fournisseurs : elles entrent en stock à l'enregistrement."
        actions={<Button asChild><Link to="/admin/achats/nouveau"><Plus className="h-4 w-4" /> Nouvel achat</Link></Button>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard icon={Wallet} label="Reste à payer aux fournisseurs" value={summary ? cfa(summary.unpaid_total) : "…"} hint={summary ? `${summary.unpaid_count} achat(s)` : undefined} tone={summary?.unpaid_total ? "warning" : "default"} onClick={() => setState("a_payer")} />
        <StatCard icon={AlertTriangle} label="Échéance dépassée" value={summary?.overdue_count ?? "…"} tone={summary?.overdue_count ? "danger" : "default"} onClick={() => setState("en_retard")} />
        <StatCard icon={ShoppingCart} label="Achats du mois" value={summary ? cfa(summary.month_total) : "…"} />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Numéro, fournisseur, bon de livraison…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <FilterChips<State> value={state} onChange={(s) => { setState(s); setPage(1); }} options={[
          { value: "tous", label: "Tous" }, { value: "a_payer", label: "À payer" }, { value: "en_retard", label: "En retard" }, { value: "annules", label: "Annulés" },
        ]} />
      </div>
      {isLoading ? <LoadingBlock /> : !data?.data.length ? (
        <EmptyState icon={ShoppingCart} title="Aucun achat">Enregistrez la livraison d'un fournisseur pour faire entrer la marchandise en stock.</EmptyState>
      ) : (
        <Panel bodyClassName="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Achat</TableHead>
                <TableHead className="hidden sm:table-cell">Reçu le</TableHead>
                <TableHead className="text-right">Total TTC</TableHead>
                <TableHead className="text-right">Reste</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((p) => (
                <TableRow key={p.id} className={cn("cursor-pointer", p.cancelled_at && "opacity-60")} onClick={() => navigate(`/admin/achats/${p.id}`)}>
                  <TableCell>
                    <Link to={`/admin/achats/${p.id}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:underline">{p.supplier?.name}</Link>
                    <p className="text-xs text-muted-foreground">{p.number}{p.supplier_reference && ` · ${p.supplier_reference}`}</p>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{formatDate(p.received_on)}</TableCell>
                  <TableCell className={cn("whitespace-nowrap text-right tabular-nums", p.cancelled_at && "line-through")}>{cfa(p.total)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    {p.cancelled_at ? <StatusBadge option={{ value: "annulee", label: "Annulé" }} />
                      : p.balance > 0 ? <span className={cn("tabular-nums", p.is_overdue ? "font-medium text-red-600" : "")}>{cfa(p.balance)}</span>
                      : <StatusBadge option={{ value: "payee", label: "Payé" }} />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}
      {data && <div className="mt-4"><Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onChange={setPage} /></div>}
    </>
  );
}
