import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { HardHat, Phone, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Paginated, Worker } from "../types";
import { cfa } from "../components/billing";
import { EmptyState, LoadingBlock, PageHeader, Panel } from "../components/ui";
import { WorkerDialog } from "../components/worksite/WorkerDialog";
import { useAuth } from "../auth";

/** Tâcherons : artisans et ouvriers payés à la journée ou à la tâche, avec ce qui leur reste dû. */
export default function WorkersPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [all, setAll] = useState(false);
  const [creating, setCreating] = useState(false);
  const query = { search: search || undefined, all: all ? 1 : undefined, per_page: 200 };
  const { data, isLoading } = useQuery({
    queryKey: ["workers", query],
    queryFn: () => api<Paginated<Worker>>("/workers", { query }),
  });
  const workers = data?.data ?? [];
  const money = can("works.team", "works.payments", "works.costs");
  const due = workers.reduce((sum, w) => sum + Math.max(0, w.balance ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Tâcherons"
        description={money && due > 0 ? `Reste à payer à l'ensemble des tâcherons : ${cfa(due)}.` : "Artisans et ouvriers des chantiers, payés à la journée ou à la tâche."}
        actions={can("works.team") && <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Nouveau tâcheron</Button>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Nom ou téléphone…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground"><Switch checked={all} onCheckedChange={setAll} /> Afficher les désactivés</label>
      </div>
      {isLoading ? <LoadingBlock /> : !workers.length ? (
        <EmptyState icon={HardHat} title={search ? "Aucun tâcheron trouvé" : "Aucun tâcheron"}>
          Enregistrez les maçons, carreleurs, manœuvres… qui travaillent sur vos chantiers pour les pointer et suivre leurs paiements.
        </EmptyState>
      ) : (
        <Panel bodyClassName="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Tâcheron</TableHead>
                <TableHead className="hidden md:table-cell">Métier</TableHead>
                <TableHead className="hidden sm:table-cell">Rémunération</TableHead>
                {money && <TableHead className="text-right">Solde</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {workers.map((w) => (
                <TableRow key={w.id} className={cn("cursor-pointer", !w.is_active && "opacity-60")} onClick={() => navigate(`/admin/tacherons/${w.id}`)}>
                  <TableCell>
                    <Link to={`/admin/tacherons/${w.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{w.name}</Link>
                    {!w.is_active && <span className="ml-2 text-xs text-muted-foreground">désactivé</span>}
                    {w.phone && <a href={`tel:${w.phone}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-xs text-muted-foreground hover:underline"><Phone className="h-3 w-3" />{w.phone}</a>}
                  </TableCell>
                  <TableCell className="hidden text-sm md:table-cell">{w.trade?.name ?? "—"}</TableCell>
                  <TableCell className="hidden text-sm sm:table-cell">{w.pay_type.value === "journalier" ? `${cfa(w.daily_rate)} / jour` : "À la tâche"}</TableCell>
                  {money && (
                    <TableCell className={cn("text-right tabular-nums", (w.balance ?? 0) > 0 && "font-medium text-red-600", (w.balance ?? 0) < 0 && "text-amber-700")}>
                      {w.balance ? cfa(w.balance) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {money && <p className="border-t px-5 py-2 text-xs text-muted-foreground">Solde positif : reste à payer. Négatif : avance pas encore couverte par du travail.</p>}
        </Panel>
      )}
      {creating && <WorkerDialog onClose={() => setCreating(false)} onSaved={(w) => navigate(`/admin/tacherons/${w.id}`)} />}
    </>
  );
}
