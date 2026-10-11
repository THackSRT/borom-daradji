import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, Ban, ClipboardEdit, Coins, Package, Pencil, Phone, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApiMutation } from "../hooks";
import type { ArticleDetail } from "../types";
import { cfa } from "../components/billing";
import { qty } from "../stock";
import { ArticleDialog } from "../components/stock/ArticleDialog";
import { StockExitDialog } from "../components/stock/StockExitDialog";
import { EmptyState, Field, LoadingBlock, Panel, StatCard, StatusBadge } from "../components/ui";

/** Fiche article : stock, coût moyen, mouvements, historique des prix d'achat. */
export default function ArticleDetailPage() {
  const { id } = useParams();
  const [editing, setEditing] = useState(false);
  const [dialog, setDialog] = useState<"perte" | "correction" | "sortie" | null>(null);
  const { data: a, isLoading, isError } = useQuery({
    queryKey: ["article", id],
    queryFn: () => api<{ data: ArticleDetail }>(`/articles/${id}`).then((r) => r.data),
  });

  if (isLoading) return <LoadingBlock />;
  if (isError || !a) return <EmptyState title="Article introuvable" action={<Button asChild variant="outline"><Link to="/admin/stock">Retour au stock</Link></Button>} />;
  const costs = a.average_cost !== undefined;

  return (
    <>
      <Link to="/admin/stock" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Stock</Link>
      <section className="mb-6 flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{a.name}</h1>
            {a.is_low && <StatusBadge option={{ value: "en_retard", label: "À réapprovisionner" }} />}
            {!a.is_active && <StatusBadge option={{ value: "annulee", label: "Désactivé" }} />}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{[a.reference, a.category?.name, a.location].filter(Boolean).join(" · ")}</p>
          {a.supplier && (
            <p className="mt-1 text-sm">Fournisseur : <Link className="font-medium hover:underline" to={`/admin/clients/${a.supplier.id}`}>{a.supplier.name}</Link>
              {a.supplier.phone && <a href={`tel:${a.supplier.phone}`} className="ml-2 inline-flex items-center gap-1 text-muted-foreground hover:underline"><Phone className="h-3 w-3" />{a.supplier.phone}</a>}</p>
          )}
          {a.notes && <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{a.notes}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {a.can.issue && a.is_active && <Button variant="outline" onClick={() => setDialog("sortie")}><ArrowUpRight className="h-4 w-4" /> Sortie chantier</Button>}
          {a.can.issue && <Button variant="outline" onClick={() => setDialog("perte")}><Ban className="h-4 w-4" /> Perte</Button>}
          {a.can.inventory && <Button variant="outline" onClick={() => setDialog("correction")}><ClipboardEdit className="h-4 w-4" /> Corriger</Button>}
          {a.can.manage && <Button variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Modifier</Button>}
        </div>
      </section>

      <div className={cn("mb-6 grid gap-4 sm:grid-cols-2", costs ? "lg:grid-cols-4" : "lg:grid-cols-2")}>
        <StatCard icon={Package} label={`En stock (${a.unit})`} value={qty(a.quantity)} hint={`Seuil ${qty(a.min_quantity)}${a.max_quantity ? ` · max ${qty(a.max_quantity)}` : ""}`} tone={a.quantity <= 0 ? "danger" : a.is_low ? "warning" : "default"} />
        <StatCard icon={Coins} label="Prix de vente HT" value={cfa(a.sale_price)} hint={`TVA ${a.vat_rate} %`} />
        {costs && <StatCard icon={Coins} label="Coût moyen pondéré" value={cfa(Math.round(a.average_cost ?? 0))} hint={`Dernier achat ${cfa(a.purchase_price ?? 0)}${a.sale_price && a.average_cost ? ` · marge ${Math.round((1 - (a.average_cost ?? 0) / a.sale_price) * 100)} %` : ""}`} />}
        {costs && <StatCard icon={Wallet} label="Valeur du stock" value={cfa(a.stock_value ?? 0)} tone="success" />}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title="Mouvements" bodyClassName="p-0">
          {!a.movements.length ? <p className="p-5 text-sm text-muted-foreground">Aucun mouvement : le stock entre par un achat.</p> : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Date</TableHead>
                  <TableHead>Mouvement</TableHead>
                  <TableHead className="text-right">Qté</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Stock</TableHead>
                  {costs && <TableHead className="hidden text-right md:table-cell">Valeur</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {a.movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(m.moved_on)}</TableCell>
                    <TableCell className="text-sm">
                      <p className="font-medium">{m.type.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.worksite && <Link className="hover:underline" to={`/admin/chantiers/${m.worksite.id}`}>{m.worksite.reference} · </Link>}
                        {m.purchase && <Link className="hover:underline" to={`/admin/achats/${m.purchase.id}`}>{m.purchase.number} · </Link>}
                        {m.invoice && <Link className="hover:underline" to={`/admin/factures/${m.invoice.id}`}>{m.invoice.number} · </Link>}
                        {m.reason && !m.purchase && !m.invoice && <>{m.reason} · </>}{m.author?.name}
                      </p>
                    </TableCell>
                    <TableCell className={cn("whitespace-nowrap text-right tabular-nums font-medium", m.quantity < 0 ? "text-red-600" : "text-emerald-700")}>{m.quantity > 0 ? "+" : ""}{qty(m.quantity)}</TableCell>
                    <TableCell className="hidden whitespace-nowrap text-right tabular-nums text-muted-foreground sm:table-cell">{qty(m.quantity_after)}</TableCell>
                    {costs && <TableCell className="hidden whitespace-nowrap text-right tabular-nums md:table-cell">{cfa(m.value ?? 0)}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
        {a.purchase_prices && (
          <Panel title="Prix d'achat" bodyClassName="p-0">
            {!a.purchase_prices.length ? <p className="p-5 text-sm text-muted-foreground">Aucun achat.</p> : (
              <ul className="divide-y">
                {a.purchase_prices.map((p) => (
                  <li key={`${p.purchase.id}-${p.unit_cost}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0">
                      <Link to={`/admin/achats/${p.purchase.id}`} className="font-medium hover:underline">{p.purchase.number}</Link>
                      <p className="truncate text-xs text-muted-foreground">{formatDate(p.received_on)} · {p.supplier} · {qty(p.quantity)} {a.unit}</p>
                    </div>
                    <span className="shrink-0 tabular-nums">{cfa(p.unit_cost)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>

      {editing && <ArticleDialog article={a} onClose={() => setEditing(false)} />}
      {dialog === "sortie" && <StockExitDialog initial={a} onClose={() => setDialog(null)} />}
      {(dialog === "perte" || dialog === "correction") && <QuantityDialog article={a} kind={dialog} onClose={() => setDialog(null)} />}
    </>
  );
}

function QuantityDialog({ article, kind, onClose }: { article: ArticleDetail; kind: "perte" | "correction"; onClose: () => void }) {
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const loss = kind === "perte";
  const mutation = useApiMutation(() => api(`/articles/${article.id}/${loss ? "loss" : "correction"}`, {
    method: "POST",
    body: loss ? { quantity: Number(quantity.replace(",", ".")), reason } : { counted_quantity: Number(quantity.replace(",", ".")), reason },
  }), { success: loss ? "Perte enregistrée." : "Stock corrigé.", invalidate: [["article", String(article.id)], ["articles"]], onSuccess: onClose });
  const err = (f: string) => mutation.error?.field(f);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{loss ? "Perte ou casse" : "Corriger le stock"}</DialogTitle>
          <DialogDescription>{loss ? "Marchandise abîmée, volée ou périmée : elle sort du stock à son coût moyen." : `Stock actuel : ${qty(article.quantity)} ${article.unit}. Saisissez la quantité réellement constatée.`}</DialogDescription>
        </DialogHeader>
        <Field label={loss ? `Quantité perdue (${article.unit})` : `Quantité constatée (${article.unit})`} error={err("quantity") ?? err("counted_quantity")}>
          <Input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} autoFocus />
        </Field>
        <Field label="Motif" error={err("reason")}><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={loss ? "Sacs mouillés par la pluie" : "Recomptage après livraison"} /></Field>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={() => mutation.mutate(undefined)} disabled={quantity === "" || !reason.trim() || mutation.isPending}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
