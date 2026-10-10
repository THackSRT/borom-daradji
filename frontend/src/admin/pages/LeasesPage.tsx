import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Home, KeyRound, Plus, Search, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth } from "../auth";
import type { Lease, LeaseSummary, Paginated } from "../types";
import { cfa } from "../components/billing";
import { EmptyState, FilterChips, LoadingBlock, PageHeader, Pagination, StatCard, StatusBadge } from "../components/ui";

const filters = [
  { value: "actif", label: "En cours" },
  { value: "arrieres", label: "Avec arriérés" },
  { value: "resilie", label: "Résiliés" },
  { value: "all", label: "Tous" },
];

export default function LeasesPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const filter = params.get("filtre") ?? "actif";
  const setFilter = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === "actif") next.delete("filtre"); else next.set("filtre", value);
    setParams(next, { replace: true });
    setPage(1);
  };

  const query = {
    search,
    page,
    status: filter === "actif" || filter === "resilie" ? filter : undefined,
    arrears: filter === "arrieres" ? 1 : undefined,
  };
  const { data, isLoading } = useQuery({
    queryKey: ["leases", query],
    queryFn: () => api<Paginated<Lease> & { summary: LeaseSummary }>("/leases", { query }),
    placeholderData: keepPreviousData,
  });
  const summary = data?.summary;

  return (
    <>
      <PageHeader
        title="Baux"
        description="Locations en cours : chaque mois, l'appel de loyer est émis automatiquement ; les arriérés se relancent par WhatsApp."
        actions={can("leases.manage") && <Button asChild><Link to="/admin/baux/nouveau"><Plus className="h-4 w-4" /> Nouveau bail</Link></Button>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard icon={KeyRound} label="Baux en cours" value={summary?.active ?? "…"} onClick={() => setFilter("actif")} />
        <StatCard icon={Wallet} label="Loyers et charges par mois" value={summary ? cfa(summary.monthly_rent) : "…"} />
        <StatCard icon={AlertTriangle} label={`Arriérés${summary?.leases_in_arrears ? ` (${summary.leases_in_arrears} bail${summary.leases_in_arrears > 1 ? "x" : ""})` : ""}`}
          value={summary ? cfa(summary.arrears) : "…"} tone={summary?.arrears ? "danger" : "success"} onClick={() => setFilter("arrieres")} className="col-span-2 lg:col-span-1" />
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterChips value={filter} onChange={setFilter} options={filters} />
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="bg-card pl-9" placeholder="Locataire, bien ou référence" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      {isLoading ? <LoadingBlock /> : !data?.data.length ? (
        <EmptyState icon={Home} title={filter === "arrieres" ? "Aucun arriéré" : "Aucun bail ici"}
          action={can("leases.manage") && filter !== "arrieres" && <Button asChild><Link to="/admin/baux/nouveau"><Plus className="h-4 w-4" /> Créer un bail</Link></Button>}>
          {filter === "arrieres" ? "Tous les loyers échus sont payés." : "Un bail se crée depuis un bien à louer et un locataire."}
        </EmptyState>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Locataire</TableHead>
                  <TableHead className="hidden md:table-cell">Bien</TableHead>
                  <TableHead className="hidden lg:table-cell">Depuis</TableHead>
                  <TableHead className="text-right">Loyer</TableHead>
                  <TableHead className="text-right">Arriérés</TableHead>
                  <TableHead className="hidden sm:table-cell">État</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((lease) => (
                  <TableRow key={lease.id} className="cursor-pointer" onClick={() => navigate(`/admin/baux/${lease.id}`)}>
                    <TableCell>
                      <p className="font-medium">{lease.tenant.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{lease.reference}{lease.managed && " · en gestion"}</p>
                    </TableCell>
                    <TableCell className="hidden max-w-[16rem] truncate text-sm md:table-cell">{lease.property.title}</TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{formatDate(lease.start_date)}</TableCell>
                    <TableCell className="text-right tabular-nums">{cfa(lease.rent + lease.charges)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", lease.arrears ? "font-medium text-red-600" : "text-muted-foreground")}>
                      {lease.arrears ? <>{cfa(lease.arrears)}<span className="block text-xs font-normal">{lease.months_overdue} mois</span></> : "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell"><StatusBadge option={lease.status.value === "actif" ? { value: "actif", label: "En cours" } : { value: "resilie", label: "Résilié" }} /></TableCell>
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
