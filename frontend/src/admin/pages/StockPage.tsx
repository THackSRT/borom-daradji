import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowUpRight, Boxes, ClipboardCheck, Package, PackageX, Plus, Search, Settings2, ShoppingCart, Store, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useApiMutation } from "../hooks";
import type { Article, ArticleCategory, Paginated, StockSummary } from "../types";
import { cfa } from "../components/billing";
import { qty } from "../stock";
import { ArticleDialog } from "../components/stock/ArticleDialog";
import { StockExitDialog } from "../components/stock/StockExitDialog";
import { EmptyState, FilterChips, LoadingBlock, PageHeader, Panel, StatCard } from "../components/ui";
import { useAuth } from "../auth";

/** Stock : articles, quantités, alertes de seuil, valeur au coût moyen pondéré. */
export default function StockPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [filter, setFilter] = useState<"tous" | "alerte">("tous");
  const [inactive, setInactive] = useState(false);
  const [creating, setCreating] = useState(false);
  const [exit, setExit] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const { data: categories = [] } = useQuery({ queryKey: ["article-categories"], queryFn: () => api<{ data: ArticleCategory[] }>("/article-categories").then((r) => r.data) });
  const query = { search: search || undefined, category_id: category === "all" ? undefined : category, low: filter === "alerte" ? 1 : undefined, all: inactive ? 1 : undefined, per_page: 500 };
  const { data, isLoading } = useQuery({
    queryKey: ["articles", query],
    queryFn: () => api<Paginated<Article> & { summary: StockSummary }>("/articles", { query }),
  });
  const articles = data?.data ?? [];
  const summary = data?.summary;
  const costs = can("stock.costs");

  return (
    <>
      <PageHeader
        title="Stock"
        description="Matériaux en magasin, valorisés au coût moyen pondéré. Les entrées passent par les achats."
        actions={
          <div className="flex flex-wrap gap-2">
            {can("stock.sell") && <Button variant="outline" asChild><Link to="/admin/comptoir"><Store className="h-4 w-4" /> Comptoir</Link></Button>}
            {can("stock.purchases") && <Button variant="outline" asChild><Link to="/admin/achats/nouveau"><ShoppingCart className="h-4 w-4" /> Achat</Link></Button>}
            {can("stock.issue") && <Button variant="outline" onClick={() => setExit(true)}><ArrowUpRight className="h-4 w-4" /> Sortie chantier</Button>}
            {can("stock.manage") && <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Nouvel article</Button>}
          </div>
        }
      />
      <div className={cn("mb-6 grid gap-4 sm:grid-cols-2", costs ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        <StatCard icon={Package} label="Articles actifs" value={summary?.articles ?? "…"} onClick={() => setFilter("tous")} />
        <StatCard icon={AlertTriangle} label="Sous le seuil d'alerte" value={summary?.low ?? "…"} tone={summary?.low ? "warning" : "default"} onClick={() => setFilter("alerte")} />
        <StatCard icon={PackageX} label="En rupture" value={summary?.out_of_stock ?? "…"} tone={summary?.out_of_stock ? "danger" : "default"} />
        {costs && <StatCard icon={Wallet} label="Valeur du stock" value={summary?.stock_value !== undefined ? cfa(summary.stock_value) : "…"} tone="success" />}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Désignation, référence, emplacement…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <FilterChips<"tous" | "alerte"> value={filter} onChange={setFilter} options={[{ value: "tous", label: "Tous" }, { value: "alerte", label: "À réapprovisionner", count: summary?.low }]} />
        <label className="flex items-center gap-2 text-sm text-muted-foreground"><Switch checked={inactive} onCheckedChange={setInactive} /> Désactivés</label>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterChips value={category} onChange={setCategory} options={[{ value: "all", label: "Toutes catégories" }, ...categories.map((c) => ({ value: String(c.id), label: c.name, count: c.articles_count }))]} />
        {can("stock.manage") && <Button size="sm" variant="ghost" onClick={() => setCategoriesOpen(true)}><Settings2 className="h-4 w-4" /> Catégories</Button>}
      </div>

      {isLoading ? <LoadingBlock /> : !articles.length ? (
        <EmptyState icon={Boxes} title={search || filter !== "tous" || category !== "all" ? "Aucun article trouvé" : "Aucun article"}>
          Créez les fiches des matériaux vendus ou utilisés sur les chantiers, puis enregistrez un achat pour les faire entrer en stock.
        </EmptyState>
      ) : (
        <Panel bodyClassName="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Article</TableHead>
                <TableHead className="hidden md:table-cell">Catégorie</TableHead>
                <TableHead className="text-right">En stock</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Prix de vente</TableHead>
                {costs && <TableHead className="hidden text-right lg:table-cell">Coût moyen</TableHead>}
                {costs && <TableHead className="hidden text-right lg:table-cell">Valeur</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {articles.map((a) => (
                <TableRow key={a.id} className={cn("cursor-pointer", !a.is_active && "opacity-60")} onClick={() => navigate(`/admin/stock/${a.id}`)}>
                  <TableCell>
                    <Link to={`/admin/stock/${a.id}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:underline">{a.name}</Link>
                    <p className="text-xs text-muted-foreground">{a.reference}{a.location && ` · ${a.location}`}</p>
                  </TableCell>
                  <TableCell className="hidden text-sm md:table-cell">{a.category?.name ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">
                    <span className={cn("font-medium", a.quantity <= 0 ? "text-red-600" : a.is_low && "text-orange-600")}>{qty(a.quantity)}</span>{" "}
                    <span className="text-xs text-muted-foreground">{a.unit}</span>
                    {a.is_low && <p className="text-[11px] text-orange-600">seuil {qty(a.min_quantity)}</p>}
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-right tabular-nums sm:table-cell">{cfa(a.sale_price)}</TableCell>
                  {costs && <TableCell className="hidden whitespace-nowrap text-right tabular-nums text-muted-foreground lg:table-cell">{cfa(Math.round(a.average_cost ?? 0))}</TableCell>}
                  {costs && <TableCell className="hidden whitespace-nowrap text-right tabular-nums lg:table-cell">{cfa(a.stock_value ?? 0)}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}
      <div className="mt-4 flex flex-wrap gap-3 text-sm">
        {can("stock.inventory") && <Link to="/admin/inventaires" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline"><ClipboardCheck className="h-4 w-4" /> Inventaires</Link>}
      </div>

      {creating && <ArticleDialog onClose={() => setCreating(false)} onSaved={(a) => navigate(`/admin/stock/${a.id}`)} />}
      {exit && <StockExitDialog onClose={() => setExit(false)} />}
      {categoriesOpen && <CategoriesDialog categories={categories} onClose={() => setCategoriesOpen(false)} />}
    </>
  );
}

function CategoriesDialog({ categories, onClose }: { categories: ArticleCategory[]; onClose: () => void }) {
  const [name, setName] = useState("");
  const keys = [["article-categories"]];
  const create = useApiMutation(() => api("/article-categories", { method: "POST", body: { name } }), { success: "Catégorie ajoutée.", invalidate: keys, onSuccess: () => setName("") });
  const toggle = useApiMutation((c: ArticleCategory) => api(`/article-categories/${c.id}`, { method: "PUT", body: { is_active: !c.is_active } }), { invalidate: keys });
  const { data: all = categories } = useQuery({ queryKey: ["article-categories", "all"], queryFn: () => api<{ data: ArticleCategory[] }>("/article-categories", { query: { all: 1 } }).then((r) => r.data) });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Catégories d'articles</DialogTitle><DialogDescription>Une catégorie désactivée n'est plus proposée ; ses articles restent.</DialogDescription></DialogHeader>
        <ul className="max-h-80 divide-y overflow-y-auto rounded-lg border">
          {all.map((c) => (
            <li key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <span className={cn(!c.is_active && "text-muted-foreground line-through")}>{c.name} <span className="text-xs text-muted-foreground">({c.articles_count ?? 0})</span></span>
              <Switch checked={c.is_active} onCheckedChange={() => toggle.mutate(c)} />
            </li>
          ))}
        </ul>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) create.mutate(undefined); }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nouvelle catégorie" />
          <Button type="submit" disabled={!name.trim() || create.isPending}>Ajouter</Button>
        </form>
        {create.error?.field("name") && <p className="text-xs text-destructive">{create.error.field("name")}</p>}
      </DialogContent>
    </Dialog>
  );
}
