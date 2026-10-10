import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Home, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { useAuth } from "../auth";
import { useApiMutation, useOptions } from "../hooks";
import type { Paginated, Property } from "../types";
import { PropertyForm, type PropertyPayload } from "../components/PropertyForm";
import { EmptyState, LoadingBlock, PageHeader, Pagination, StatusBadge } from "../components/ui";

export default function PropertiesPage() {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const statuses = useOptions("property_statuses");
  const transactions = useOptions("transaction_types");
  const [filters, setFilters] = useState({ search: "", status: "all", transaction: "all", archived: false, page: 1 });
  const [creating, setCreating] = useState(false);

  const query = {
    search: filters.search,
    status: filters.status === "all" ? undefined : filters.status,
    transaction: filters.transaction === "all" ? undefined : filters.transaction,
    archived: filters.archived || undefined,
    page: filters.page,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["properties", query],
    queryFn: () => api<Paginated<Property>>("/properties", { query }),
  });

  const create = useApiMutation((body: PropertyPayload) => api<{ data: Property }>("/properties", { method: "POST", body }), {
    success: "Bien créé. Complétez la vérification foncière pour le publier.",
    invalidate: [["properties"]],
    onSuccess: (r) => navigate(`/admin/biens/${r.data.id}`),
  });

  const update = (patch: Partial<typeof filters>) => setFilters({ ...filters, page: 1, ...patch });

  return (
    <>
      <PageHeader
        title="Biens"
        description="Portefeuille de l'agence. Un bien n'apparaît sur le site qu'après la vérification foncière."
        actions={hasRole("agent") && <Button variant="gold" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Nouveau bien</Button>}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Titre ou référence" value={filters.search} onChange={(e) => update({ search: e.target.value })} />
        </div>
        <Select value={filters.status} onValueChange={(v) => update({ status: v })}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            {statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.transaction} onValueChange={(v) => update({ transaction: v })}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vente et location</SelectItem>
            {transactions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant={filters.archived ? "navy" : "outline"} onClick={() => update({ archived: !filters.archived })}>
          {filters.archived ? "Voir les biens actifs" : "Voir les archives"}
        </Button>
      </div>

      {isLoading ? <LoadingBlock /> : !data?.data.length ? <EmptyState>Aucun bien ne correspond.</EmptyState> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.data.map((p) => (
            <Link key={p.id} to={`/admin/biens/${p.id}`}>
              <Card className="overflow-hidden transition-shadow hover:shadow-lg">
                <div className="flex aspect-[16/9] items-center justify-center bg-muted">
                  {p.cover_url ? <img src={p.cover_url} alt="" className="h-full w-full object-cover" loading="lazy" /> : <Home className="h-8 w-8 text-muted-foreground" />}
                </div>
                <div className="space-y-1 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{p.reference}</span>
                    <StatusBadge option={p.status} />
                  </div>
                  <p className="line-clamp-1 font-medium">{p.title}</p>
                  <p className="text-sm text-muted-foreground">{[p.neighborhood, p.city].filter(Boolean).join(", ")} · {p.type.label}</p>
                  <p className="font-semibold text-accent">{formatPrice(p.price, p.transaction.value === "location")}</p>
                  {p.agent && <p className="text-xs text-muted-foreground">Agent : {p.agent.name}</p>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
      {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onChange={(page) => setFilters({ ...filters, page })} />}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>Nouveau bien</DialogTitle></DialogHeader>
          <PropertyForm error={create.error} pending={create.isPending} onSubmit={(p) => create.mutate(p)} onCancel={() => setCreating(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
