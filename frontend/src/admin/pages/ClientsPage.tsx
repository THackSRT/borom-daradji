import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { fromNow } from "@/lib/format";
import { useApiMutation, useOptions } from "../hooks";
import type { Client, Paginated } from "../types";
import { ClientForm } from "../components/ClientForm";
import { EmptyState, FormError, LoadingBlock, PageHeader, Pagination, StatusBadge, WhatsAppLink } from "../components/ui";

export default function ClientsPage() {
  const navigate = useNavigate();
  const pipeline = useOptions("pipeline_statuses");
  const categories = useOptions("client_categories");
  const [filters, setFilters] = useState({ search: "", pipeline_status: "all", category: "all", mine: false, page: 1 });
  const [creating, setCreating] = useState(false);

  const query = {
    search: filters.search,
    pipeline_status: filters.pipeline_status === "all" ? undefined : filters.pipeline_status,
    category: filters.category === "all" ? undefined : filters.category,
    mine: filters.mine || undefined,
    page: filters.page,
  };

  const { data, isLoading } = useQuery({ queryKey: ["clients", query], queryFn: () => api<Paginated<Client>>("/clients", { query }) });

  const create = useApiMutation((body: Record<string, unknown>) => api<{ data: Client }>("/clients", { method: "POST", body }), {
    success: "Client créé.",
    invalidate: [["clients"]],
    onSuccess: (r) => navigate(`/admin/clients/${r.data.id}`),
  });

  // 409 : ce numéro existe déjà, on propose d'ouvrir la fiche existante.
  const duplicate = create.error?.status === 409 ? (create.error.data as { message: string; client: { data?: Client } & Client }) : null;
  const duplicateClient = duplicate ? (duplicate.client.data ?? duplicate.client) : null;

  const update = (patch: Partial<typeof filters>) => setFilters({ ...filters, page: 1, ...patch });

  return (
    <>
      <PageHeader
        title="Clients"
        description="Prospects, acheteurs, locataires, propriétaires, fournisseurs. Un numéro = un client."
        actions={<Button variant="gold" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Nouveau client</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Nom, téléphone ou email" value={filters.search} onChange={(e) => update({ search: e.target.value })} />
        </div>
        <Select value={filters.pipeline_status} onValueChange={(v) => update({ pipeline_status: v })}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les étapes</SelectItem>
            {pipeline.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.category} onValueChange={(v) => update({ category: v })}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes catégories</SelectItem>
            {categories.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={filters.mine} onCheckedChange={(v) => update({ mine: v === true })} /> Mes clients
        </label>
      </div>

      {isLoading ? <LoadingBlock /> : !data?.data.length ? <EmptyState>Aucun client ne correspond.</EmptyState> : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Étape</TableHead>
                <TableHead className="hidden md:table-cell">Catégories</TableHead>
                <TableHead className="hidden md:table-cell">Dernier contact</TableHead>
                <TableHead className="hidden lg:table-cell">Suivi par</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link to={`/admin/clients/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
                    <div className="text-xs text-muted-foreground">{c.phone}</div>
                  </TableCell>
                  <TableCell><StatusBadge option={c.pipeline_status} /></TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{c.categories.map((x) => x.label).join(", ")}</TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{fromNow(c.last_contact_at)}</TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{c.assigned_user?.name}</TableCell>
                  <TableCell className="text-right"><WhatsAppLink url={c.whatsapp_url} label="" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onChange={(page) => setFilters({ ...filters, page })} />}

      <Dialog open={creating} onOpenChange={(o) => { setCreating(o); if (!o) create.reset(); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Nouveau client</DialogTitle></DialogHeader>
          {duplicate && duplicateClient && (
            <div className="space-y-2">
              <FormError message={duplicate.message} />
              <Button asChild variant="navy" size="sm"><Link to={`/admin/clients/${duplicateClient.id}`}>Ouvrir la fiche de {duplicateClient.name}</Link></Button>
            </div>
          )}
          <ClientForm error={create.error} pending={create.isPending} onSubmit={(p) => create.mutate(p)} onCancel={() => setCreating(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
