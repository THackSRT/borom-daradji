import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, FileText, Plus, Receipt, Search, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth } from "../auth";
import type { Invoice, InvoiceSummary, Paginated } from "../types";
import { cfa, InvoiceStateBadge } from "../components/billing";
import { EmptyState, FilterChips, LoadingBlock, PageHeader, Pagination, StatCard } from "../components/ui";

const filters = [
  { value: "all", label: "Toutes" },
  { value: "a_encaisser", label: "À encaisser" },
  { value: "en_retard", label: "En retard" },
  { value: "payee", label: "Payées" },
  { value: "brouillon", label: "Brouillons" },
  { value: "avoir", label: "Avoirs" },
];

export default function InvoicesPage() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canCreate = hasRole("comptable");
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const filter = params.get("filtre") ?? "all";

  const setFilter = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === "all") next.delete("filtre"); else next.set("filtre", value);
    setParams(next, { replace: true });
    setPage(1);
  };

  const query = {
    search,
    page,
    state: ["a_encaisser", "en_retard", "payee"].includes(filter) ? filter : undefined,
    status: filter === "brouillon" ? "brouillon" : undefined,
    type: filter === "avoir" ? "avoir" : undefined,
  };
  const { data, isLoading } = useQuery({
    queryKey: ["invoices", query],
    queryFn: () => api<Paginated<Invoice> & { summary: InvoiceSummary }>("/invoices", { query }),
    placeholderData: keepPreviousData,
  });
  const summary = data?.summary;

  return (
    <>
      <PageHeader
        title="Factures"
        description="Factures et avoirs, encaissements, relances. Une facture émise ne se modifie plus : on la corrige par un avoir."
        actions={canCreate && <Button asChild><Link to="/admin/factures/nouvelle"><Plus className="h-4 w-4" /> Nouvelle facture</Link></Button>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard icon={Wallet} label="Reste à encaisser" value={summary ? cfa(summary.outstanding) : "…"} onClick={() => setFilter("a_encaisser")} />
        <StatCard icon={AlertTriangle} label={`En retard${summary?.overdue_count ? ` (${summary.overdue_count})` : ""}`} value={summary ? cfa(summary.overdue) : "…"}
          tone={summary?.overdue ? "danger" : undefined} onClick={() => setFilter("en_retard")} />
        <StatCard icon={FileText} label="Brouillons à émettre" value={summary?.drafts ?? "…"} onClick={() => setFilter("brouillon")} className="col-span-2 lg:col-span-1" />
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterChips value={filter} onChange={setFilter} options={filters} />
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="bg-card pl-9" placeholder="Numéro ou client" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      {isLoading ? <LoadingBlock /> : !data?.data.length ? (
        <EmptyState icon={Receipt} title="Aucune facture ici"
          action={canCreate && <Button asChild><Link to="/admin/factures/nouvelle"><Plus className="h-4 w-4" /> Créer une facture</Link></Button>}>
          {filter === "en_retard" ? "Aucune facture en retard : tout est à jour." : "Les factures émises et leurs encaissements apparaîtront ici."}
        </EmptyState>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Numéro</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="hidden md:table-cell">Émise le</TableHead>
                  <TableHead className="hidden md:table-cell">Échéance</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Reste</TableHead>
                  <TableHead>État</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((inv) => (
                  <TableRow key={inv.id} className="cursor-pointer" onClick={() => navigate(`/admin/factures/${inv.id}`)}>
                    <TableCell className="font-medium">
                      {inv.number ?? <span className="text-muted-foreground">Brouillon</span>}
                      {inv.type.value === "avoir" && <span className="ml-1.5 text-xs text-muted-foreground">avoir</span>}
                    </TableCell>
                    <TableCell className="max-w-[12rem] truncate">{inv.client.name}</TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{formatDate(inv.issue_date)}</TableCell>
                    <TableCell className={cn("hidden text-sm md:table-cell", inv.is_overdue ? "font-medium text-red-600" : "text-muted-foreground")}>{formatDate(inv.due_date)}</TableCell>
                    <TableCell className="text-right tabular-nums">{cfa(inv.type.value === "avoir" ? -inv.total : inv.total)}</TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{inv.balance > 0 ? cfa(inv.balance) : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell><InvoiceStateBadge invoice={inv} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onChange={setPage} />
        </>
      )}
    </>
  );
}
