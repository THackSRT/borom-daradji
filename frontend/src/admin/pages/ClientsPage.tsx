import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Columns3, List, MoreHorizontal, Phone, Plus, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { fromNow } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApiMutation, useOptions } from "../hooks";
import type { Client, Paginated } from "../types";
import { useQuickCreate } from "../components/QuickCreate";
import { Avatar, EmptyState, FilterChips, LoadingBlock, PageHeader, Pagination, StatusBadge, WhatsAppLink } from "../components/ui";

type ViewMode = "list" | "pipeline";

const columnTone: Record<string, string> = {
  nouveau: "bg-blue-500",
  contacte: "bg-sky-500",
  visite: "bg-violet-500",
  negociation: "bg-amber-500",
  gagne: "bg-emerald-500",
  perdu: "bg-slate-400",
};

export default function ClientsPage() {
  const navigate = useNavigate();
  const quickCreate = useQuickCreate();
  const pipeline = useOptions("pipeline_statuses");
  const categories = useOptions("client_categories");
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<ViewMode>("list");
  const [search, setSearch] = useState("");
  const [mine, setMine] = useState(false);
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const stage = params.get("etape") ?? "all";

  const setStage = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === "all") next.delete("etape"); else next.set("etape", value);
    setParams(next, { replace: true });
    setPage(1);
  };

  const query = {
    search,
    pipeline_status: view === "list" && stage !== "all" ? stage : undefined,
    category: category === "all" ? undefined : category,
    mine: mine || undefined,
    page: view === "list" ? page : 1,
    per_page: view === "pipeline" ? 100 : 25,
  };
  const { data, isLoading } = useQuery({
    queryKey: ["clients", query],
    queryFn: () => api<Paginated<Client>>("/clients", { query }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <PageHeader
        title="Clients"
        description="Prospects, acheteurs, locataires, propriétaires, fournisseurs. Un numéro de téléphone = un client."
        actions={<Button onClick={() => quickCreate.open("client")}><Plus className="h-4 w-4" /> Nouveau client</Button>}
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="bg-card pl-9" placeholder="Nom, téléphone ou email" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
            <SelectTrigger className="w-44 bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes catégories</SelectItem>
              {categories.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 px-2 text-sm text-muted-foreground"><Switch checked={mine} onCheckedChange={setMine} /> Mes clients</label>
        </div>
        <div className="flex rounded-lg border bg-card p-0.5">
          <Button variant="ghost" size="sm" className={cn("h-8", view === "list" && "bg-muted")} onClick={() => setView("list")}><List className="h-4 w-4" /> Liste</Button>
          <Button variant="ghost" size="sm" className={cn("h-8", view === "pipeline" && "bg-muted")} onClick={() => setView("pipeline")}><Columns3 className="h-4 w-4" /> Pipeline</Button>
        </div>
      </div>

      {view === "list" && (
        <div className="mb-5"><FilterChips value={stage} onChange={setStage} options={[{ value: "all", label: "Toutes les étapes" }, ...pipeline.map((p) => ({ value: p.value, label: p.label }))]} /></div>
      )}

      {isLoading ? <LoadingBlock /> : !data?.data.length ? (
        <EmptyState icon={Users} title="Aucun client ne correspond" action={<Button onClick={() => quickCreate.open("client")}><Plus className="h-4 w-4" /> Ajouter un client</Button>}>
          Les demandes envoyées depuis le site arrivent ici automatiquement.
        </EmptyState>
      ) : view === "pipeline" ? (
        <Pipeline clients={data.data} />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Client</TableHead>
                  <TableHead>Étape</TableHead>
                  <TableHead className="hidden md:table-cell">Catégories</TableHead>
                  <TableHead className="hidden md:table-cell">Dernier contact</TableHead>
                  <TableHead className="hidden lg:table-cell">Suivi par</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/admin/clients/${c.id}`)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar name={c.name} size="sm" />
                        <div className="min-w-0"><p className="truncate font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{c.phone ?? c.email}</p></div>
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge option={c.pipeline_status} /></TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{c.categories.map((x) => x.label).join(", ")}</TableCell>
                    <TableCell className={cn("hidden text-sm md:table-cell", !c.last_contact_at ? "text-amber-700" : "text-muted-foreground")}>{c.last_contact_at ? fromNow(c.last_contact_at) : "Jamais contacté"}</TableCell>
                    <TableCell className="hidden lg:table-cell">{c.assigned_user && <span className="flex items-center gap-2 text-sm text-muted-foreground"><Avatar name={c.assigned_user.name} size="sm" />{c.assigned_user.name.split(" ")[0]}</span>}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {c.phone && <Button asChild variant="ghost" size="icon" className="h-8 w-8"><a href={`tel:${c.phone}`} aria-label="Appeler"><Phone className="h-4 w-4" /></a></Button>}
                        <WhatsAppLink url={c.whatsapp_url} size="icon" />
                      </div>
                    </TableCell>
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

/** Vue pipeline : une colonne par étape ; on fait avancer un prospect depuis sa carte. */
function Pipeline({ clients }: { clients: Client[] }) {
  const pipeline = useOptions("pipeline_statuses");
  const move = useApiMutation(
    ({ id, stage }: { id: number; stage: string }) => api(`/clients/${id}`, { method: "PUT", body: { pipeline_status: stage } }),
    { invalidate: [["clients"], ["dashboard"]] },
  );

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4 lg:mx-0 lg:px-0">
      <div className="grid min-w-[1100px] grid-cols-6 gap-3">
        {pipeline.map((column) => {
          const items = clients.filter((c) => c.pipeline_status.value === column.value);
          return (
            <div key={column.value} className="flex flex-col rounded-xl bg-muted/60 p-2">
              <div className="mb-2 flex items-center justify-between px-1.5 py-1">
                <span className="flex items-center gap-2 text-sm font-semibold"><span className={cn("h-2 w-2 rounded-full", columnTone[column.value])} />{column.label}</span>
                <span className="rounded-full bg-card px-2 text-xs font-medium tabular-nums text-muted-foreground">{items.length}</span>
              </div>
              <div className="flex-1 space-y-2">
                {items.map((c) => (
                  <div key={c.id} className="group rounded-lg border bg-card p-3 shadow-sm transition hover:shadow-md">
                    <div className="flex items-start gap-2">
                      <Link to={`/admin/clients/${c.id}`} className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium hover:text-primary">{c.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{c.phone}</p>
                      </Link>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" aria-label="Changer d'étape"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel className="text-xs text-muted-foreground">Déplacer vers</DropdownMenuLabel>
                          {pipeline.filter((p) => p.value !== column.value).map((p) => (
                            <DropdownMenuItem key={p.value} onClick={() => move.mutate({ id: c.id, stage: p.value })}>{p.label}</DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">{c.last_contact_at ? fromNow(c.last_contact_at) : "Jamais contacté"}</span>
                      <div className="flex items-center gap-1">
                        {c.assigned_user && <Avatar name={c.assigned_user.name} size="sm" />}
                      </div>
                    </div>
                  </div>
                ))}
                {!items.length && <p className="px-2 py-6 text-center text-xs text-muted-foreground">Personne à cette étape</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
