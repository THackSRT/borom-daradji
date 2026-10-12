import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { useApiMutation } from "../hooks";
import type { Article, Purchase } from "../types";
import { AmountRow, cfa, EntityPicker, MethodPicker, MoneyInput, referenceHint, type PickerItem } from "../components/billing";
import { ArticlePicker } from "../components/stock";
import { qty, searchSuppliers } from "../stock";
import { Field, FormError, PageHeader, Panel } from "../components/ui";

const today = () => new Date().toLocaleDateString("en-CA");

interface Line { article: Article; quantity: string; unit_cost: number | ""; vat_rate: string }

/** Saisie d'un achat (bon de livraison du fournisseur) : la marchandise entre en stock à l'enregistrement. */
export default function PurchaseEditorPage() {
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState<PickerItem | null>(null);
  const [reference, setReference] = useState("");
  const [receivedOn, setReceivedOn] = useState(today());
  const [lines, setLines] = useState<Line[]>([]);
  const [paid, setPaid] = useState(false);
  const [method, setMethod] = useState("especes");
  const [amount, setAmount] = useState<number | "">("");
  const [payRef, setPayRef] = useState("");
  const [notes, setNotes] = useState("");

  const totals = useMemo(() => lines.reduce((t, l) => {
    const amountHt = Math.round(Number(l.quantity.replace(",", ".") || 0) * Number(l.unit_cost || 0));
    const vat = Math.round(amountHt * Number(l.vat_rate || 0) / 100);
    return { ht: t.ht + amountHt, vat: t.vat + vat };
  }, { ht: 0, vat: 0 }), [lines]);
  const total = totals.ht + totals.vat;

  const mutation = useApiMutation(() => api<{ data: Purchase }>("/purchases", {
    method: "POST",
    body: {
      supplier_id: supplier?.id, supplier_reference: reference || null, received_on: receivedOn, notes: notes || null,
      lines: lines.map((l) => ({ article_id: l.article.id, quantity: Number(l.quantity.replace(",", ".")), unit_cost: l.unit_cost || 0, vat_rate: Number(l.vat_rate || 0) })),
      payment: paid ? { amount: amount || total, method, reference: payRef || null } : null,
    },
  }), { success: "Achat enregistré : la marchandise est en stock.", invalidate: [["purchases"], ["articles"]], onSuccess: (r) => navigate(`/admin/achats/${r.data.id}`) });
  const err = (f: string) => mutation.error?.field(f);
  const lineError = mutation.error ? Object.entries(mutation.error.errors).find(([k]) => k.startsWith("lines"))?.[1]?.[0] : undefined;
  const valid = supplier && lines.length > 0 && lines.every((l) => Number(l.quantity.replace(",", ".")) > 0 && l.unit_cost !== "");

  return (
    <>
      <Link to="/admin/achats" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Achats</Link>
      <PageHeader title="Nouvel achat" description="Recopiez le bon de livraison ou la facture du fournisseur. Prix d'achat hors taxes." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Panel title="Fournisseur">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Fournisseur" error={err("supplier_id")} className="sm:col-span-3">
                <EntityPicker value={supplier} onChange={setSupplier} search={searchSuppliers} placeholder="Choisir un fournisseur" queryKey="suppliers" />
              </Field>
              <Field label="N° du bon ou de la facture" error={err("supplier_reference")} className="sm:col-span-2"><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="BL-2026-778" /></Field>
              <Field label="Reçu le" error={err("received_on")}><Input type="date" value={receivedOn} max={today()} onChange={(e) => setReceivedOn(e.target.value)} /></Field>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Le fournisseur n'est pas dans la liste ? Créez-le dans <Link className="underline" to="/admin/clients">Clients</Link> avec la catégorie « Fournisseur ».</p>
          </Panel>
          <Panel title="Marchandises reçues">
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={l.article.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 text-sm"><p className="truncate font-medium">{l.article.name}</p><p className="text-xs text-muted-foreground">{l.article.reference} · en stock {qty(l.article.quantity)} {l.article.unit}{l.article.purchase_price ? ` · dernier prix ${cfa(l.article.purchase_price)}` : ""}</p></div>
                    <Button size="icon" variant="ghost" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <Field label={`Quantité (${l.article.unit})`}><Input inputMode="decimal" value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} /></Field>
                    <Field label="Prix unitaire HT"><MoneyInput value={l.unit_cost} onChange={(unit_cost) => setLines(lines.map((x, j) => (j === i ? { ...x, unit_cost } : x)))} /></Field>
                    <Field label="TVA (%)"><Input inputMode="decimal" value={l.vat_rate} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, vat_rate: e.target.value } : x)))} /></Field>
                  </div>
                </div>
              ))}
              <ArticlePicker exclude={lines.map((l) => l.article.id)} onPick={(article) => setLines([...lines, { article, quantity: "", unit_cost: article.purchase_price || "", vat_rate: String(article.vat_rate) }])} />
            </div>
            <FormError message={lineError} />
          </Panel>
          <Panel title="Notes"><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Livré par camion, 2 sacs abîmés refusés…" /></Panel>
        </div>
        <aside className="space-y-4">
          <Panel title="Total">
            <AmountRow label="Total HT" value={totals.ht} tone="muted" />
            <AmountRow label="TVA" value={totals.vat} tone="muted" />
            <AmountRow label="Total TTC" value={total} strong />
          </Panel>
          <Panel title="Paiement">
            <label className="flex items-center justify-between text-sm">Payé à la livraison<Switch checked={paid} onCheckedChange={setPaid} /></label>
            {paid && (
              <div className="mt-3 space-y-3">
                <MethodPicker value={method} onChange={setMethod} error={err("method")} />
                <Field label="Montant" error={err("amount")} hint="Vide : le total"><MoneyInput value={amount} onChange={setAmount} /></Field>
                {method !== "especes" && <Field label="Référence" error={err("reference")} hint={referenceHint(method)}><Input value={payRef} onChange={(e) => setPayRef(e.target.value)} /></Field>}
              </div>
            )}
            {!paid && <p className="mt-2 text-xs text-muted-foreground">À payer plus tard depuis la fiche de l'achat (échéance à 30 jours par défaut).</p>}
          </Panel>
          <Button className="h-11 w-full" disabled={!valid || mutation.isPending} onClick={() => mutation.mutate(undefined)}>Enregistrer l'entrée en stock</Button>
        </aside>
      </div>
    </>
  );
}
