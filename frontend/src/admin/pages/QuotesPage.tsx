import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, FileSignature, FilePen, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth } from "../auth";
import type { Paginated, Quote, QuoteSummary } from "../types";
import { cfa } from "../components/billing";
import { EmptyState, FilterChips, LoadingBlock, PageHeader, Pagination, StatCard, StatusBadge } from "../components/ui";

const filters = [
  { value: "all", label: "Tous" },
  { value: "brouillon", label: "Brouillons" },
  { value: "envoye", label: "Envoyés" },
  { value: "accepte", label: "Acceptés" },
  { value: "refuse", label: "Refusés" },
  { value: "expire", label: "Expirés" },
  { value: "modeles", label: "Modèles" },
];

export default function QuotesPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
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
  const templates = filter === "modeles";

  const query = { search, page, templates: templates ? 1 : undefined, status: !templates && filter !== "all" ? filter : undefined };
  const { data, isLoading } = useQuery({
    queryKey: ["quotes", query],
    queryFn: () => api<Paginated<Quote> & { summary: QuoteSummary }>("/quotes", { query }),
    placeholderData: keepPreviousData,
  });
  const summary = data?.summary;
  const canCreate = can("works.quotes");

  return (
    <>
      <PageHeader
        title="Devis"
        description="Devis par lots, tirés du catalogue. Accepté, un devis ouvre le chantier."
        actions={
          <div className="flex gap-2">
            {can("works.catalog") && templates && <Button variant="outline" asChild><Link to="/admin/devis/nouveau?modele=1"><Plus className="h-4 w-4" /> Nouveau modèle</Link></Button>}
            {canCreate && <Button asChild><Link to="/admin/devis/nouveau"><Plus className="h-4 w-4" /> Nouveau devis</Link></Button>}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard icon={FilePen} label="Brouillons" value={summary?.drafts ?? "…"} onClick={() => setFilter("brouillon")} />
        <StatCard icon={Clock} label={`En attente de réponse${summary?.pending ? ` (${summary.pending})` : ""}`} value={summary ? cfa(summary.pending_total) : "…"} tone="warning" onClick={() => setFilter("envoye")} />
        <StatCard icon={CheckCircle2} label="Acceptés cette année" value={summary ? cfa(summary.accepted_this_year) : "…"} tone="success" onClick={() => setFilter("accepte")} className="col-span-2 lg:col-span-1" />
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <FilterChips value={filter} onChange={setFilter} options={filters} />
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="bg-card pl-9" placeholder="Client, objet ou numéro" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      {isLoading ? <LoadingBlock /> : !data?.data.length ? (
        <EmptyState icon={FileSignature} title={templates ? "Aucun modèle" : "Aucun devis ici"}
          action={canCreate && !templates && <Button asChild><Link to="/admin/devis/nouveau"><Plus className="h-4 w-4" /> Créer un devis</Link></Button>}>
          {templates ? "Un devis type (salle de bain, clôture…) s'enregistre comme modèle depuis sa fiche." : "Un devis se compose de lots tirés du catalogue de prestations."}
        </EmptyState>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>{templates ? "Modèle" : "Client et objet"}</TableHead>
                  <TableHead className="hidden md:table-cell">{templates ? "Lots" : "Date"}</TableHead>
                  <TableHead className="text-right">Total TTC</TableHead>
                  {!templates && <TableHead className="hidden sm:table-cell">État</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((quote) => (
                  <TableRow key={quote.id} className="cursor-pointer" onClick={() => navigate(`/admin/devis/${quote.id}`)}>
                    <TableCell>
                      <p className="font-medium">{templates ? quote.template_name ?? quote.title : quote.client?.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {!templates && <span className="font-mono">{quote.number}</span>}{!templates && " · "}{quote.title}
                        {quote.worksite && <> · chantier {quote.worksite.reference}</>}
                      </p>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {templates ? `${quote.lots_count ?? 0} lot(s)` : (
                        <>
                          {formatDate(quote.issue_date ?? quote.created_at)}
                          {quote.status.value === "envoye" && quote.valid_until && <span className="block text-xs">valable jusqu'au {formatDate(quote.valid_until)}</span>}
                        </>
                      )}
                    </TableCell>
                    <TableCell className={cn("text-right tabular-nums", quote.status.value === "refuse" && "text-muted-foreground line-through")}>{cfa(quote.total)}</TableCell>
                    {!templates && <TableCell className="hidden sm:table-cell"><StatusBadge option={quote.status} /></TableCell>}
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
