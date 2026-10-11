import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useApiMutation } from "../../hooks";
import type { Article } from "../../types";
import { EntityPicker, type PickerItem } from "../billing";
import { ArticlePicker } from "../stock";
import { qty, searchOpenWorksites } from "../../stock";
import { Field, FormError } from "../ui";

/** Bon de sortie vers un chantier : plusieurs articles d'un coup, au coût moyen du moment. */
export function StockExitDialog({ worksite: fixed, initial, onClose }: { worksite?: PickerItem; initial?: Article; onClose: () => void }) {
  const [worksite, setWorksite] = useState<PickerItem | null>(fixed ?? null);
  const [lines, setLines] = useState<{ article: Article; quantity: string }[]>(initial ? [{ article: initial, quantity: "" }] : []);
  const [note, setNote] = useState("");
  const mutation = useApiMutation(() => api(`/worksites/${worksite!.id}/stock-exits`, {
    method: "POST",
    body: { note: note || null, lines: lines.map((l) => ({ article_id: l.article.id, quantity: Number(l.quantity.replace(",", ".")) })) },
  }), {
    success: "Sortie enregistrée.",
    invalidate: [["articles"], ["article"], ["worksite-stock"], ["worksite-budget"], ["stock-movements"]],
    onSuccess: onClose,
  });
  const valid = worksite && lines.length > 0 && lines.every((l) => Number(l.quantity.replace(",", ".")) > 0);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sortie vers un chantier</DialogTitle>
          <DialogDescription>Les matériaux sortent au coût moyen du moment, imputé au chantier.</DialogDescription>
        </DialogHeader>
        {!fixed && (
          <Field label="Chantier" error={mutation.error?.field("worksite")}>
            <EntityPicker value={worksite} onChange={setWorksite} search={searchOpenWorksites} placeholder="Choisir un chantier ouvert" queryKey="open-worksites" />
          </Field>
        )}
        <div className="space-y-2">
          {lines.map((l, i) => {
            const over = Number(l.quantity.replace(",", ".")) > l.article.quantity;
            return (
              <div key={l.article.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate font-medium">{l.article.name}</p>
                  <p className={cn("text-xs", over ? "text-red-600" : "text-muted-foreground")}>En stock : {qty(l.article.quantity)} {l.article.unit}</p>
                </div>
                <Input inputMode="decimal" className={cn("w-24 text-right", over && "border-red-400")} placeholder="Qté" value={l.quantity}
                  onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} />
                <span className="w-12 text-xs text-muted-foreground">{l.article.unit}</span>
                <Button size="icon" variant="ghost" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            );
          })}
          <ArticlePicker inStock exclude={lines.map((l) => l.article.id)} onPick={(article) => setLines([...lines, { article, quantity: "" }])} />
        </div>
        <Field label="Note (facultatif)"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Livré par le camion de l'agence" /></Field>
        <FormError message={mutation.error?.field("quantity") ?? mutation.error?.field("lines")} />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={() => mutation.mutate(undefined)} disabled={!valid || mutation.isPending}>Enregistrer la sortie</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
