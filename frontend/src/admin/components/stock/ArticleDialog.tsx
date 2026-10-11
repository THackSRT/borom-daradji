import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useApiMutation } from "../../hooks";
import type { Article, ArticleCategory } from "../../types";
import { EntityPicker, MoneyInput, type PickerItem } from "../billing";
import { searchSuppliers, units } from "../../stock";
import { Field } from "../ui";

/** Création ou modification d'une fiche article. Quantité et coût moyen ne se saisissent pas : ils suivent les mouvements. */
export function ArticleDialog({ article, onClose, onSaved }: { article?: Article; onClose: () => void; onSaved?: (a: Article) => void }) {
  const { data: categories = [] } = useQuery({ queryKey: ["article-categories"], queryFn: () => api<{ data: ArticleCategory[] }>("/article-categories").then((r) => r.data) });
  const [form, setForm] = useState({
    reference: article?.reference ?? "",
    name: article?.name ?? "",
    article_category_id: article?.category ? String(article.category.id) : "",
    unit: article?.unit ?? "sac",
    sale_price: (article?.sale_price ?? "") as number | "",
    vat_rate: String(article?.vat_rate ?? 18),
    min_quantity: String(article?.min_quantity ?? ""),
    max_quantity: article?.max_quantity != null ? String(article.max_quantity) : "",
    location: article?.location ?? "",
    notes: article?.notes ?? "",
    is_active: article?.is_active ?? true,
  });
  const [supplier, setSupplier] = useState<PickerItem | null>(article?.supplier ? { id: article.supplier.id, label: article.supplier.name } : null);
  const set = (patch: Partial<typeof form>) => setForm({ ...form, ...patch });
  const mutation = useApiMutation(() => api<{ data: Article }>(article ? `/articles/${article.id}` : "/articles", {
    method: article ? "PUT" : "POST",
    body: {
      ...form,
      reference: form.reference || null,
      article_category_id: form.article_category_id ? Number(form.article_category_id) : null,
      sale_price: form.sale_price || 0,
      vat_rate: Number(form.vat_rate || 0),
      min_quantity: Number(form.min_quantity || 0),
      max_quantity: form.max_quantity === "" ? null : Number(form.max_quantity),
      location: form.location || null,
      notes: form.notes || null,
      supplier_id: supplier?.id ?? null,
    },
  }), {
    success: article ? "Article mis à jour." : "Article créé.",
    invalidate: [["articles"], ...(article ? [["article", String(article.id)]] : [])],
    onSuccess: (r) => { onSaved?.(r.data); onClose(); },
  });
  const err = (f: string) => mutation.error?.field(f);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{article ? `Modifier ${article.name}` : "Nouvel article"}</DialogTitle>
          <DialogDescription>Le stock entre par les achats ; le coût moyen se calcule seul.</DialogDescription>
        </DialogHeader>
        <Field label="Désignation" error={err("name")}><Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ciment CEM II 42,5 (sac de 50 kg)" autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Référence" error={err("reference")} hint={article ? undefined : "Vide : attribuée d'office"}><Input value={form.reference} onChange={(e) => set({ reference: e.target.value })} /></Field>
          <Field label="Unité" error={err("unit")}>
            <Select value={form.unit} onValueChange={(unit) => set({ unit })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{[...new Set([form.unit, ...units])].map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="Catégorie" error={err("article_category_id")}>
          <Select value={form.article_category_id || "none"} onValueChange={(v) => set({ article_category_id: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">—</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prix de vente HT" error={err("sale_price")}><MoneyInput value={form.sale_price} onChange={(sale_price) => set({ sale_price })} /></Field>
          <Field label="TVA (%)" error={err("vat_rate")}><Input inputMode="decimal" value={form.vat_rate} onChange={(e) => set({ vat_rate: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Seuil d'alerte" error={err("min_quantity")} hint="Tâche « réapprovisionner » en dessous"><Input inputMode="decimal" value={form.min_quantity} onChange={(e) => set({ min_quantity: e.target.value })} /></Field>
          <Field label="Stock maximum" error={err("max_quantity")}><Input inputMode="decimal" value={form.max_quantity} onChange={(e) => set({ max_quantity: e.target.value })} /></Field>
        </div>
        <Field label="Emplacement" error={err("location")}><Input value={form.location} onChange={(e) => set({ location: e.target.value })} placeholder="Magasin, allée 2" /></Field>
        <Field label="Fournisseur habituel" error={err("supplier_id")}>
          <EntityPicker value={supplier} onChange={setSupplier} search={searchSuppliers} placeholder="Aucun" queryKey="suppliers" allowClear />
        </Field>
        <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
        {article && <label className="flex items-center justify-between text-sm">Actif (proposé aux achats, ventes et sorties)<Switch checked={form.is_active} onCheckedChange={(is_active) => set({ is_active })} /></label>}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={() => mutation.mutate(undefined)} disabled={!form.name.trim() || mutation.isPending}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
