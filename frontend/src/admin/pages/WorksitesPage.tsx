import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AlertTriangle, HardHat, Hammer, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth } from "../auth";
import { useApiMutation } from "../hooks";
import type { Client, Paginated, Worksite, WorksiteSummary } from "../types";
import { EntityPicker, type PickerItem } from "../components/billing";
import { EmptyState, Field, FilterChips, LoadingBlock, PageHeader, Pagination, ProgressBar, StatCard, StatusBadge } from "../components/ui";

const filters = [
  { value: "ouverts", label: "En cours et à venir" },
  { value: "en_retard", label: "En retard" },
  { value: "mine", label: "Mes chantiers" },
  { value: "devis", label: "Au stade du devis" },
  { value: "termine", label: "Terminés" },
  { value: "facture", label: "Facturés" },
  { value: "all", label: "Tous" },
];

export default function WorksitesPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const filter = params.get("filtre") ?? "ouverts";
  const setFilter = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === "ouverts") next.delete("filtre"); else next.set("filtre", value);
    setParams(next, { replace: true });
    setPage(1);
  };
  const query = {
    search, page,
    state: filter === "ouverts" || filter === "en_retard" ? filter : undefined,
    status: ["devis", "termine", "facture"].includes(filter) ? filter : undefined,
    mine: filter === "mine" ? 1 : undefined,
  };
  const { data, isLoading } = useQuery({
    queryKey: ["worksites", query],
    queryFn: () => api<Paginated<Worksite> & { summary: WorksiteSummary }>("/worksites", { query }),
    placeholderData: keepPreviousData,
  });
  const summary = data?.summary;

  return (
    <>
      <PageHeader
        title="Chantiers"
        description="Un chantier s'ouvre quand le client accepte le devis : lots, avancement, journal et photos."
        actions={can("works.manage") && <Button variant="outline" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Chantier sans devis</Button>}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard icon={HardHat} label="Ouverts" value={summary?.open ?? "…"} onClick={() => setFilter("ouverts")} />
        <StatCard icon={Hammer} label="En travaux" value={summary?.in_progress ?? "…"} tone="warning" />
        <StatCard icon={AlertTriangle} label="En retard sur la date prévue" value={summary?.late ?? "…"} tone={summary?.late ? "danger" : "success"} onClick={() => setFilter("en_retard")} className="col-span-2 lg:col-span-1" />
      </div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterChips value={filter} onChange={setFilter} options={filters} />
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="bg-card pl-9" placeholder="Client, chantier, adresse" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      {isLoading ? <LoadingBlock /> : !data?.data.length ? (
        <EmptyState icon={HardHat} title="Aucun chantier ici">Accepté, un devis ouvre son chantier avec ses lots.</EmptyState>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Chantier</TableHead>
                  <TableHead className="hidden lg:table-cell">Chef de chantier</TableHead>
                  <TableHead className="w-40">Avancement</TableHead>
                  <TableHead className="hidden md:table-cell">Fin prévue</TableHead>
                  <TableHead className="hidden sm:table-cell">État</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((w) => (
                  <TableRow key={w.id} className="cursor-pointer" onClick={() => navigate(`/admin/chantiers/${w.id}`)}>
                    <TableCell>
                      <p className="font-medium">{w.title}</p>
                      <p className="truncate text-xs text-muted-foreground"><span className="font-mono">{w.reference}</span> · {w.client.name}{w.address && ` · ${w.address}`}</p>
                    </TableCell>
                    <TableCell className="hidden text-sm lg:table-cell">{w.manager?.name ?? <span className="text-muted-foreground">À désigner</span>}</TableCell>
                    <TableCell><ProgressBar value={w.progress ?? 0} total={100} label={`${w.progress ?? 0} %`} /></TableCell>
                    <TableCell className={cn("hidden text-sm md:table-cell", w.is_late ? "font-medium text-red-600" : "text-muted-foreground")}>{formatDate(w.planned_end_date)}</TableCell>
                    <TableCell className="hidden sm:table-cell"><StatusBadge option={w.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onChange={setPage} />
        </>
      )}
      {creating && <NewWorksiteDialog onClose={() => setCreating(false)} />}
    </>
  );
}

const searchClients = (term: string) =>
  api<Paginated<Client>>("/clients", { query: { search: term, per_page: 10 } })
    .then((r) => r.data.map((c) => ({ id: c.id, label: c.name, hint: c.phone ?? undefined })));

function NewWorksiteDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [client, setClient] = useState<PickerItem | null>(null);
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const mutation = useApiMutation(() => api<{ data: Worksite }>("/worksites", { method: "POST", body: { client_id: client?.id, title, address: address || null } }), {
    success: "Chantier ouvert au stade du devis.", invalidate: [["worksites"]], onSuccess: (r) => navigate(`/admin/chantiers/${r.data.id}`),
  });
  const err = (f: string) => mutation.error?.field(f);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ouvrir un chantier sans devis accepté</DialogTitle>
          <DialogDescription>Pour suivre une étude ou des visites avant le devis. L'acceptation du devis y ajoutera les lots.</DialogDescription>
        </DialogHeader>
        <Field label="Client" error={err("client_id")}><EntityPicker value={client} onChange={setClient} search={searchClients} placeholder="Choisir le client" queryKey="clients" /></Field>
        <Field label="Intitulé" htmlFor="ws-title" error={err("title")}><Input id="ws-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Construction villa R+1 à Ngor" /></Field>
        <Field label="Adresse" htmlFor="ws-address" error={err("address")}><Input id="ws-address" value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={() => mutation.mutate(undefined)} disabled={mutation.isPending}>Ouvrir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
