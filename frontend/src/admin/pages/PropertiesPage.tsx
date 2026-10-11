import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { BedDouble, Building2, Home, LayoutGrid, List, Maximize, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth } from "../auth";
import { useOptions } from "../hooks";
import type { Paginated, Property } from "../types";
import { useQuickCreate } from "../components/QuickCreate";
import { Avatar, EmptyState, FilterChips, PageHeader, Pagination, ProgressBar, SkeletonGrid, StatusBadge } from "../components/ui";

type ViewMode = "grid" | "list";

function readView(): ViewMode {
  try {
    return localStorage.getItem("borom_properties_view") === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
}

export default function PropertiesPage() {
  const { can } = useAuth();
  const quickCreate = useQuickCreate();
  const navigate = useNavigate();
  const statuses = useOptions("property_statuses");
  const transactions = useOptions("transaction_types");
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<ViewMode>(readView);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const status = params.get("statut") ?? "all";
  const transaction = params.get("transaction") ?? "all";
  const archived = params.get("archives") === "1";

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null || value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
    setPage(1);
  };

  const changeView = (mode: ViewMode) => {
    setView(mode);
    try { localStorage.setItem("borom_properties_view", mode); } catch { /* préférence non conservée */ }
  };

  const query = {
    search,
    status: status === "all" ? undefined : status,
    transaction: transaction === "all" ? undefined : transaction,
    archived: archived || undefined,
    page,
    per_page: 24,
  };
  const { data, isLoading } = useQuery({
    queryKey: ["properties", query],
    queryFn: () => api<Paginated<Property>>("/properties", { query }),
    placeholderData: keepPreviousData,
  });

  const counts = data?.status_counts ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const chips = [
    { value: "all", label: "Tous", count: total },
    ...statuses.filter((s) => counts[s.value] || s.value === status).map((s) => ({ value: s.value, label: s.label, count: counts[s.value] ?? 0 })),
  ];

  return (
    <>
      <PageHeader
        title="Biens"
        description="Un bien n'apparaît sur le site qu'une fois sa vérification foncière terminée."
        actions={can("properties.create") && <Button onClick={() => quickCreate.open("property")}><Plus className="h-4 w-4" /> Nouveau bien</Button>}
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="bg-card pl-9" placeholder="Titre ou référence (BD-2026-…)" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select value={transaction} onValueChange={(v) => setParam("transaction", v)}>
            <SelectTrigger className="w-40 bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Vente et location</SelectItem>
              {transactions.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" className={cn(archived && "bg-muted")} onClick={() => setParam("archives", archived ? null : "1")}>
            {archived ? "Biens actifs" : "Archives"}
          </Button>
        </div>
        <div className="flex rounded-lg border bg-card p-0.5">
          <Button variant="ghost" size="icon" className={cn("h-8 w-8", view === "grid" && "bg-muted")} onClick={() => changeView("grid")} aria-label="Vue en cartes"><LayoutGrid className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className={cn("h-8 w-8", view === "list" && "bg-muted")} onClick={() => changeView("list")} aria-label="Vue en liste"><List className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="mb-5"><FilterChips value={status} onChange={(v) => setParam("statut", v)} options={chips} /></div>

      {isLoading ? <SkeletonGrid /> : !data?.data.length ? (
        <EmptyState icon={Building2} title="Aucun bien ne correspond"
          action={can("properties.create") && !archived ? <Button onClick={() => quickCreate.open("property")}><Plus className="h-4 w-4" /> Ajouter un bien</Button> : undefined}>
          Modifiez les filtres ou ajoutez un nouveau bien.
        </EmptyState>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.data.map((p) => <PropertyCard key={p.id} property={p} />)}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Bien</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Prix</TableHead>
                <TableHead className="hidden lg:table-cell">Vérification</TableHead>
                <TableHead className="hidden md:table-cell">Agent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((p) => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate(`/admin/biens/${p.id}`)}>
                  <TableCell>
                    <Link to={`/admin/biens/${p.id}`} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                        {p.cover_url ? <img src={p.cover_url} alt="" className="h-full w-full object-cover" loading="lazy" /> : <Home className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.title}</p>
                        <p className="text-xs text-muted-foreground"><span className="font-mono">{p.reference}</span> · {[p.neighborhood, p.city].filter(Boolean).join(", ")}</p>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell><StatusBadge option={p.status} /></TableCell>
                  <TableCell className="whitespace-nowrap text-right font-medium tabular-nums">{formatPrice(p.price, p.transaction.value === "location")}</TableCell>
                  <TableCell className="hidden w-40 lg:table-cell">{p.checks_progress && <ProgressBar value={p.checks_progress.cleared} total={p.checks_progress.total} />}</TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{p.agent?.name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onChange={setPage} />}
    </>
  );
}

function PropertyCard({ property: p }: { property: Property }) {
  const isDraft = p.status.value === "brouillon";
  return (
    <Link to={`/admin/biens/${p.id}`} className="group block overflow-hidden rounded-xl border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {p.cover_url ? (
          <img src={p.cover_url} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
        ) : (
          <div className="flex h-full items-center justify-center"><Home className="h-8 w-8 text-muted-foreground/50" /></div>
        )}
        <div className="absolute left-3 top-3"><StatusBadge option={p.status} className="bg-white/95 shadow-sm backdrop-blur" /></div>
        <span className="absolute right-3 top-3 rounded-md bg-black/55 px-2 py-0.5 text-xs font-medium text-white backdrop-blur">{p.transaction.label}</span>
      </div>
      <div className="space-y-2 p-4">
        <div>
          <p className="text-lg font-semibold tabular-nums text-foreground">{formatPrice(p.price, p.transaction.value === "location")}</p>
          <p className="line-clamp-1 text-sm font-medium text-foreground/90">{p.title}</p>
          <p className="text-xs text-muted-foreground">{[p.neighborhood, p.city].filter(Boolean).join(", ")}</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="font-mono">{p.reference}</span>
          {p.surface && <span className="inline-flex items-center gap-1"><Maximize className="h-3.5 w-3.5" />{p.surface} m²</span>}
          {!!p.bedrooms && <span className="inline-flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" />{p.bedrooms}</span>}
        </div>
        {isDraft && p.checks_progress ? (
          <div className="border-t pt-2">
            <p className="mb-1 text-xs text-muted-foreground">Vérification foncière</p>
            <ProgressBar value={p.checks_progress.cleared} total={p.checks_progress.total} />
          </div>
        ) : p.agent && (
          <div className="flex items-center gap-2 border-t pt-2 text-xs text-muted-foreground">
            <Avatar name={p.agent.name} size="sm" /> {p.agent.name}
          </div>
        )}
      </div>
    </Link>
  );
}
