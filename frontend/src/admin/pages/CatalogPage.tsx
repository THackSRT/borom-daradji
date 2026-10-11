import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Pencil, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useApiMutation } from "../hooks";
import type { CatalogItem, Trade } from "../types";
import { cfa, MoneyInput } from "../components/billing";
import { EmptyState, Field, FormError, LoadingBlock, PageHeader, Panel } from "../components/ui";

const units = ["m²", "m³", "ml", "u", "forfait", "jour", "kg", "t", "sac", "voyage"];

/** Catalogue des travaux : corps de métier à gauche, prestations et prix à droite. */
export default function CatalogPage() {
  const [tradeId, setTradeId] = useState<number | "all">("all");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | "new" | null>(null);
  const [tradeDialog, setTradeDialog] = useState<Trade | "new" | null>(null);

  const { data: trades = [] } = useQuery({
    queryKey: ["trades", { all: true }],
    queryFn: () => api<{ data: Trade[] }>("/trades", { query: { all: 1 } }).then((r) => r.data),
  });
  const query = { trade_id: tradeId === "all" ? undefined : tradeId, search: search || undefined, all: showInactive ? 1 : undefined, limit: 500 };
  const { data: items, isLoading } = useQuery({
    queryKey: ["catalog-items", query],
    queryFn: () => api<{ data: CatalogItem[] }>("/catalog-items", { query }).then((r) => r.data),
  });
  const current = trades.find((t) => t.id === tradeId);

  return (
    <>
      <PageHeader
        title="Catalogue des travaux"
        description="Prestations par corps de métier, avec leur prix HT : elles alimentent les lignes des devis."
        actions={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Nouvelle prestation</Button>}
      />
      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Panel title="Corps de métier" action={<Button size="sm" variant="ghost" onClick={() => setTradeDialog("new")}><Plus className="h-4 w-4" /></Button>} bodyClassName="p-2">
          <div className="lg:hidden">
            <Select value={String(tradeId)} onValueChange={(v) => setTradeId(v === "all" ? "all" : Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les corps de métier</SelectItem>
                {trades.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <nav className="hidden space-y-0.5 lg:block">
            <button type="button" onClick={() => setTradeId("all")} className={cn("flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm", tradeId === "all" ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted")}>
              Tous
            </button>
            {trades.map((t) => (
              <button key={t.id} type="button" onClick={() => setTradeId(t.id)}
                className={cn("flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm", tradeId === t.id ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted", !t.is_active && "text-muted-foreground line-through")}>
                <span className="truncate">{t.name}</span>
                <span className="text-xs tabular-nums text-muted-foreground">{t.items_count}</span>
              </button>
            ))}
          </nav>
        </Panel>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="bg-card pl-9" placeholder="Rechercher une prestation" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-muted-foreground"><Switch checked={showInactive} onCheckedChange={setShowInactive} /> Désactivées</label>
              {current && <Button size="sm" variant="outline" onClick={() => setTradeDialog(current)}><Pencil className="h-4 w-4" /> {current.name}</Button>}
            </div>
          </div>
          {isLoading ? <LoadingBlock /> : !items?.length ? (
            <EmptyState icon={BookOpen} title="Aucune prestation" action={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Ajouter une prestation</Button>}>
              Ajoutez les prestations courantes avec leur unité et leur prix : elles se reprennent en un clic dans les devis.
            </EmptyState>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Prestation</TableHead>
                    <TableHead className="hidden md:table-cell">Corps de métier</TableHead>
                    <TableHead className="text-right">Prix HT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} className={cn("cursor-pointer", !item.is_active && "text-muted-foreground")} onClick={() => setEditing(item)}>
                      <TableCell>
                        <p className={cn("font-medium", !item.is_active && "line-through")}>{item.designation}</p>
                        {item.description && <p className="truncate text-xs text-muted-foreground">{item.description}</p>}
                      </TableCell>
                      <TableCell className="hidden text-sm md:table-cell">{item.trade?.name}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">{cfa(item.unit_price)} <span className="text-xs text-muted-foreground">/ {item.unit}</span></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      {editing && <ItemDialog item={editing === "new" ? null : editing} trades={trades} defaultTrade={tradeId === "all" ? trades[0]?.id : tradeId} onClose={() => setEditing(null)} />}
      {tradeDialog && <TradeDialog trade={tradeDialog === "new" ? null : tradeDialog} onClose={() => setTradeDialog(null)} />}
    </>
  );
}

function ItemDialog({ item, trades, defaultTrade, onClose }: { item: CatalogItem | null; trades: Trade[]; defaultTrade?: number; onClose: () => void }) {
  const [form, setForm] = useState({
    trade_id: item?.trade?.id ?? defaultTrade ?? 0,
    designation: item?.designation ?? "",
    unit: item?.unit ?? "m²",
    unit_price: (item?.unit_price ?? "") as number | "",
    vat_rate: item?.vat_rate ?? null as number | null,
    description: item?.description ?? "",
    is_active: item?.is_active ?? true,
  });
  const mutation = useApiMutation(() => api(item ? `/catalog-items/${item.id}` : "/catalog-items", {
    method: item ? "PUT" : "POST",
    body: { ...form, unit_price: form.unit_price || 0, description: form.description || null },
  }), { success: item ? "Prestation modifiée." : "Prestation ajoutée.", invalidate: [["catalog-items"], ["trades"]], onSuccess: onClose });
  const err = (f: string) => mutation.error?.field(f);
  const submit = (e: FormEvent) => { e.preventDefault(); mutation.mutate(undefined); };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{item ? "Modifier la prestation" : "Nouvelle prestation"}</DialogTitle>
            <DialogDescription>Le prix change pour les prochains devis ; les devis déjà faits gardent le leur.</DialogDescription>
          </DialogHeader>
          <Field label="Corps de métier" error={err("trade_id")}>
            <Select value={form.trade_id ? String(form.trade_id) : undefined} onValueChange={(v) => setForm({ ...form, trade_id: Number(v) })}>
              <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
              <SelectContent>{trades.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Désignation" htmlFor="ci-designation" error={err("designation")}>
            <Input id="ci-designation" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="Ex. Pose de carrelage au sol (fourniture non comprise)" />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Unité" error={err("unit")}>
              <Select value={form.unit} onValueChange={(unit) => setForm({ ...form, unit })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[...new Set([form.unit, ...units])].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Prix HT" error={err("unit_price")} className="col-span-2">
              <MoneyInput value={form.unit_price} onChange={(unit_price) => setForm({ ...form, unit_price })} />
            </Field>
          </div>
          <Field label="TVA (%)" htmlFor="ci-vat" hint="Vide : taux de l'entreprise." error={err("vat_rate")}>
            <Input id="ci-vat" type="number" min={0} max={100} step="0.5" value={form.vat_rate ?? ""} onChange={(e) => setForm({ ...form, vat_rate: e.target.value === "" ? null : Number(e.target.value) })} />
          </Field>
          <Field label="Précisions (facultatif)" htmlFor="ci-desc">
            <Textarea id="ci-desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          {item && (
            <label className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm font-medium">
              Proposée dans les devis <Switch checked={form.is_active} onCheckedChange={(is_active) => setForm({ ...form, is_active })} />
            </label>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={mutation.isPending}>Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TradeDialog({ trade, onClose }: { trade: Trade | null; onClose: () => void }) {
  const [name, setName] = useState(trade?.name ?? "");
  const [active, setActive] = useState(trade?.is_active ?? true);
  const mutation = useApiMutation(() => api(trade ? `/trades/${trade.id}` : "/trades", {
    method: trade ? "PUT" : "POST", body: trade ? { name, is_active: active } : { name },
  }), { success: "Corps de métier enregistré.", invalidate: [["trades"]], onSuccess: onClose });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{trade ? "Modifier le corps de métier" : "Nouveau corps de métier"}</DialogTitle></DialogHeader>
        <FormError message={mutation.error?.field("trade")} />
        <Field label="Nom" htmlFor="trade-name" error={mutation.error?.field("name")}>
          <Input id="trade-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        {trade && (
          <label className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm font-medium">
            Actif <Switch checked={active} onCheckedChange={setActive} />
          </label>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={() => mutation.mutate(undefined)} disabled={mutation.isPending || !name}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
