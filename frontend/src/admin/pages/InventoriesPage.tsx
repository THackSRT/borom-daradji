import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ClipboardCheck, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApiMutation } from "../hooks";
import type { ArticleCategory, InventoryDetail, InventorySummaryRow } from "../types";
import { cfa } from "../components/billing";
import { EmptyState, Field, FormError, LoadingBlock, PageHeader, Panel, StatusBadge } from "../components/ui";

const today = () => new Date().toLocaleDateString("en-CA");

/** Inventaires physiques : en cours et historique. */
export default function InventoriesPage() {
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  const { data: list, isLoading } = useQuery({ queryKey: ["inventories"], queryFn: () => api<{ data: InventorySummaryRow[] }>("/inventories").then((r) => r.data) });
  const current = list?.find((i) => i.status.value === "en_cours");

  return (
    <>
      <Link to="/admin/stock" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Stock</Link>
      <PageHeader title="Inventaires" description="Comptez le stock réel ; à la validation, les écarts sont ajustés et valorisés au coût moyen."
        actions={current ? <Button asChild><Link to={`/admin/inventaires/${current.id}`}><ClipboardCheck className="h-4 w-4" /> Reprendre le comptage</Link></Button>
          : <Button onClick={() => setStarting(true)}><Plus className="h-4 w-4" /> Nouvel inventaire</Button>} />
      {isLoading ? <LoadingBlock /> : !list?.length ? (
        <EmptyState icon={ClipboardCheck} title="Aucun inventaire">Un inventaire par mois, ou par catégorie, garde le stock du logiciel fidèle au magasin.</EmptyState>
      ) : (
        <Panel bodyClassName="p-0">
          <ul className="divide-y">
            {list.map((i) => (
              <li key={i.id}>
                <button type="button" onClick={() => navigate(`/admin/inventaires/${i.id}`)} className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-sm hover:bg-muted/50">
                  <div className="min-w-0">
                    <p className="font-medium">{i.number} <span className="font-normal text-muted-foreground">· {i.category?.name ?? "Tous les articles"}</span></p>
                    <p className="text-xs text-muted-foreground">Compté le {formatDate(i.counted_on)} · {i.counted_count}/{i.lines_count} articles{i.validator && ` · validé par ${i.validator.name}`}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {i.value_difference !== null && i.status.value === "valide" && <span className={cn("tabular-nums", i.value_difference < 0 ? "text-red-600" : i.value_difference > 0 ? "text-emerald-700" : "text-muted-foreground")}>{i.value_difference > 0 ? "+" : ""}{cfa(i.value_difference)}</span>}
                    <StatusBadge option={{ value: i.status.value === "valide" ? "payee" : "en_cours", label: i.status.label }} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {starting && <StartDialog onClose={() => setStarting(false)} onStarted={(id) => navigate(`/admin/inventaires/${id}`)} />}
    </>
  );
}

function StartDialog({ onClose, onStarted }: { onClose: () => void; onStarted: (id: number) => void }) {
  const { data: categories = [] } = useQuery({ queryKey: ["article-categories"], queryFn: () => api<{ data: ArticleCategory[] }>("/article-categories").then((r) => r.data) });
  const [category, setCategory] = useState("all");
  const [date, setDate] = useState(today());
  const mutation = useApiMutation(() => api<{ data: InventoryDetail }>("/inventories", { method: "POST", body: { counted_on: date, article_category_id: category === "all" ? null : Number(category) } }), {
    invalidate: [["inventories"]], onSuccess: (r) => onStarted(r.data.id),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Nouvel inventaire</DialogTitle><DialogDescription>La liste des articles à compter est préparée ; le stock théorique n'est pas affiché pendant le comptage.</DialogDescription></DialogHeader>
        <Field label="Articles à compter">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les articles</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Date du comptage"><Input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></Field>
        <FormError message={mutation.error?.field("inventory") ?? mutation.error?.field("article_category_id")} />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={() => mutation.mutate(undefined)} disabled={mutation.isPending}>Commencer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
