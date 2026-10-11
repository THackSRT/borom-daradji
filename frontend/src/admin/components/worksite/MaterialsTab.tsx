import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApiMutation } from "../../hooks";
import type { Worksite, WorksiteStock } from "../../types";
import { cfa } from "../billing";
import { qty } from "../../stock";
import { StockExitDialog } from "../stock/StockExitDialog";
import { Field, FormError, Panel } from "../ui";

/** Onglet « Matériaux » : ce qui est sorti du stock vers le chantier (au coût moyen), retours compris. */
export function MaterialsTab({ worksite }: { worksite: Worksite }) {
  const [exit, setExit] = useState(false);
  const [returning, setReturning] = useState(false);
  const { data } = useQuery({
    queryKey: ["worksite-stock", worksite.id],
    queryFn: () => api<{ data: WorksiteStock }>(`/worksites/${worksite.id}/stock`).then((r) => r.data),
  });
  if (!data) return <Panel><p className="text-sm text-muted-foreground">Chargement…</p></Panel>;
  const open = ["planifie", "en_cours", "suspendu"].includes(worksite.status.value);
  const costs = data.total !== null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Panel title="Matériaux livrés depuis le stock" bodyClassName="p-0"
        action={data.can.issue && (
          <div className="flex flex-wrap justify-end gap-2">
            {data.articles.length > 0 && <Button size="sm" variant="outline" onClick={() => setReturning(true)}><ArrowDownLeft className="h-4 w-4" /> Retour</Button>}
            {open && <Button size="sm" onClick={() => setExit(true)}><ArrowUpRight className="h-4 w-4" /> Sortie du stock</Button>}
          </div>
        )}>
        {!data.articles.length ? (
          <p className="p-5 text-sm text-muted-foreground">Rien n'est encore sorti du stock pour ce chantier. Les achats faits sur place passent par la caisse du chantier.</p>
        ) : (
          <ul className="divide-y">
            {data.articles.map((a) => (
              <li key={a.article.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0"><Link to={`/admin/stock/${a.article.id}`} className="font-medium hover:underline">{a.article.name}</Link><p className="text-xs text-muted-foreground">{a.article.reference}</p></div>
                <div className="shrink-0 text-right">
                  <p className="tabular-nums">{qty(a.quantity)} {a.article.unit}</p>
                  {costs && <p className="text-xs tabular-nums text-muted-foreground">{cfa(a.value ?? 0)}</p>}
                </div>
              </li>
            ))}
            {costs && <li className="flex justify-between bg-muted/40 px-5 py-3 text-sm font-semibold"><span>Total au coût moyen</span><span className="tabular-nums">{cfa(data.total ?? 0)}</span></li>}
          </ul>
        )}
      </Panel>
      <Panel title="Bons de sortie et retours" bodyClassName="p-0">
        {!data.movements.length ? <p className="p-5 text-sm text-muted-foreground">Aucun mouvement.</p> : (
          <ul className="divide-y">
            {data.movements.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0"><p className="truncate">{m.article?.name}</p><p className="text-xs text-muted-foreground">{formatDate(m.moved_on)} · {m.type.label}{m.author && ` · ${m.author.name}`}</p></div>
                <span className={cn("shrink-0 tabular-nums font-medium", m.quantity < 0 ? "text-amber-700" : "text-emerald-700")}>{m.quantity < 0 ? "" : "−"}{qty(Math.abs(m.quantity))} {m.article?.unit}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {exit && <StockExitDialog worksite={{ id: worksite.id, label: `${worksite.reference} · ${worksite.title}` }} onClose={() => setExit(false)} />}
      {returning && <ReturnDialog worksite={worksite} stock={data} onClose={() => setReturning(false)} />}
    </div>
  );
}

function ReturnDialog({ worksite, stock, onClose }: { worksite: Worksite; stock: WorksiteStock; onClose: () => void }) {
  const [articleId, setArticleId] = useState(String(stock.articles[0]?.article.id ?? ""));
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const current = stock.articles.find((a) => String(a.article.id) === articleId);
  const mutation = useApiMutation(() => api(`/worksites/${worksite.id}/stock-returns`, { method: "POST", body: { article_id: Number(articleId), quantity: Number(quantity.replace(",", ".")), note: note || null } }), {
    success: "Retour enregistré : les matériaux sont de nouveau en stock.", invalidate: [["worksite-stock", worksite.id], ["worksite-budget", worksite.id], ["articles"]], onSuccess: onClose,
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Retour au dépôt</DialogTitle><DialogDescription>Matériaux non utilisés : ils rentrent en stock à leur coût de sortie et ne comptent plus dans le coût du chantier.</DialogDescription></DialogHeader>
        <Field label="Article">
          <Select value={articleId} onValueChange={setArticleId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{stock.articles.map((a) => <SelectItem key={a.article.id} value={String(a.article.id)}>{a.article.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label={`Quantité rendue${current ? ` (au plus ${qty(current.quantity)} ${current.article.unit})` : ""}`} error={mutation.error?.field("quantity")}>
          <Input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} autoFocus />
        </Field>
        <Field label="Note (facultatif)"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <FormError message={mutation.error?.field("article_id")} />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={() => mutation.mutate(undefined)} disabled={!quantity || mutation.isPending}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
