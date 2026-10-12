import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Download, Minus, Plus, Receipt, Store, Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, downloadFile } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useApiMutation } from "../hooks";
import type { Article } from "../types";
import { AmountRow, cfa, EntityPicker, MethodPicker, MoneyInput, referenceHint, type PickerItem } from "../components/billing";
import { ArticlePicker } from "../components/stock";
import { qty, searchClients } from "../stock";
import { Field, FormError, PageHeader, Panel } from "../components/ui";
import { useAuth } from "../auth";

interface Line { article: Article; quantity: string; unit_price: number | "" }
interface Sale { id: number; number: string; client: { id: number; name: string }; total: number; paid_total: number; balance: number }

/**
 * Vente de matériaux au comptoir : la facture est émise et le stock diminue dès la validation ;
 * l'encaissement peut se faire dans le même geste.
 */
export default function CounterPage() {
  const { can } = useAuth();
  const canCollect = can("payments.create");
  const [lines, setLines] = useState<Line[]>([]);
  const [clientMode, setClientMode] = useState<"existant" | "nouveau">("nouveau");
  const [client, setClient] = useState<PickerItem | null>(null);
  const [newClient, setNewClient] = useState({ name: "", phone: "" });
  const [collect, setCollect] = useState(canCollect);
  const [method, setMethod] = useState("especes");
  const [amount, setAmount] = useState<number | "">("");
  const [reference, setReference] = useState("");
  const [sale, setSale] = useState<Sale | null>(null);

  const totals = useMemo(() => lines.reduce((t, l) => {
    const ht = Math.round(Number(l.quantity.replace(",", ".") || 0) * Number(l.unit_price || 0));
    return { ht: t.ht + ht, vat: t.vat + Math.round(ht * l.article.vat_rate / 100) };
  }, { ht: 0, vat: 0 }), [lines]);
  const total = totals.ht + totals.vat;

  const mutation = useApiMutation(() => api<{ data: Sale }>("/counter-sales", {
    method: "POST",
    body: {
      ...(clientMode === "existant" ? { client_id: client?.id } : { new_client: { name: newClient.name, phone: newClient.phone || null } }),
      lines: lines.map((l) => ({ article_id: l.article.id, quantity: Number(l.quantity.replace(",", ".")), unit_price: l.unit_price === "" ? null : l.unit_price })),
      payment: collect ? { amount: amount === "" ? total : amount, method, reference: reference || null } : null,
    },
  }), { success: "Vente enregistrée.", invalidate: [["articles"], ["invoices"], ["cash-session"]], onSuccess: (r) => setSale(r.data) });
  const err = (f: string) => mutation.error?.field(f);
  const qtyError = err("quantity") ?? (mutation.error ? Object.entries(mutation.error.errors).find(([k]) => k.startsWith("lines"))?.[1]?.[0] : undefined);
  const clientOk = clientMode === "existant" ? !!client : newClient.name.trim().length > 0;
  const valid = clientOk && lines.length > 0 && lines.every((l) => Number(l.quantity.replace(",", ".")) > 0);

  const reset = () => {
    setLines([]); setClient(null); setNewClient({ name: "", phone: "" }); setAmount(""); setReference(""); setSale(null); setMethod("especes"); mutation.reset();
  };
  const setLine = (i: number, patch: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const step = (i: number, delta: number) => setLine(i, { quantity: String(Math.max(0, Number(lines[i].quantity.replace(",", ".") || 0) + delta)) });

  if (sale) {
    return (
      <div className="mx-auto max-w-md pt-6 text-center">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
        <h1 className="mt-3 text-2xl font-semibold">Vente enregistrée</h1>
        <p className="mt-1 text-muted-foreground">{sale.client.name} · facture {sale.number}</p>
        <div className="mt-5 rounded-xl border bg-card p-4 text-left">
          <AmountRow label="Total TTC" value={sale.total} strong />
          <AmountRow label="Encaissé" value={sale.paid_total} tone="green" />
          <AmountRow label="Reste à payer" value={sale.balance} tone={sale.balance ? "red" : undefined} />
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={() => downloadFile(`/invoices/${sale.id}/pdf`, `${sale.number}.pdf`)}><Download className="h-4 w-4" /> Facture PDF</Button>
          <Button variant="outline" asChild><Link to={`/admin/factures/${sale.id}`}><Receipt className="h-4 w-4" /> Voir la facture</Link></Button>
          <Button onClick={reset}><Store className="h-4 w-4" /> Nouvelle vente</Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Comptoir" description="Vente de matériaux : la facture est émise et le stock diminue à la validation." />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel title="Articles vendus">
          <div className="space-y-2">
            {lines.map((l, i) => {
              const over = Number(l.quantity.replace(",", ".")) > l.article.quantity;
              return (
                <div key={l.article.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 text-sm">
                      <p className="truncate font-medium">{l.article.name}</p>
                      <p className={cn("text-xs", over ? "text-red-600" : "text-muted-foreground")}>{l.article.reference} · en stock {qty(l.article.quantity)} {l.article.unit}</p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => setLines(lines.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-end gap-3">
                    <div>
                      <p className="mb-1 text-xs text-muted-foreground">Quantité ({l.article.unit})</p>
                      <div className="flex items-center">
                        <Button size="icon" variant="outline" className="h-10 w-10 rounded-r-none" onClick={() => step(i, -1)}><Minus className="h-4 w-4" /></Button>
                        <Input inputMode="decimal" className={cn("h-10 w-20 rounded-none text-center", over && "border-red-400")} value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
                        <Button size="icon" variant="outline" className="h-10 w-10 rounded-l-none" onClick={() => step(i, 1)}><Plus className="h-4 w-4" /></Button>
                      </div>
                    </div>
                    <div className="w-40">
                      <p className="mb-1 text-xs text-muted-foreground">Prix unitaire HT</p>
                      <MoneyInput value={l.unit_price} onChange={(unit_price) => setLine(i, { unit_price })} />
                    </div>
                    <p className="ml-auto pb-2 text-sm font-medium tabular-nums">{cfa(Math.round(Number(l.quantity.replace(",", ".") || 0) * Number(l.unit_price || 0)))}</p>
                  </div>
                  {l.article.average_cost !== undefined && l.unit_price !== "" && l.unit_price < (l.article.average_cost ?? 0) && (
                    <p className="mt-1 text-xs text-red-600">Prix inférieur au coût moyen ({cfa(Math.round(l.article.average_cost ?? 0))}).</p>
                  )}
                </div>
              );
            })}
            <ArticlePicker inStock showPrice label="Ajouter un article" exclude={lines.map((l) => l.article.id)} onPick={(article) => setLines([...lines, { article, quantity: "1", unit_price: article.sale_price }])} />
          </div>
          <FormError message={qtyError} />
        </Panel>

        <aside className="space-y-4">
          <Panel title="Client">
            <div className="mb-3 grid grid-cols-2 gap-2">
              {([["nouveau", "Client de passage", UserPlus], ["existant", "Client connu", Users]] as const).map(([v, label, Icon]) => (
                <button key={v} type="button" onClick={() => setClientMode(v)}
                  className={cn("flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-sm font-medium", clientMode === v ? "border-primary bg-primary/5 text-primary ring-1 ring-primary" : "hover:bg-muted")}>
                  <Icon className="h-4 w-4" />{label}
                </button>
              ))}
            </div>
            {clientMode === "existant" ? (
              <Field label="Client" error={err("client_id")}><EntityPicker value={client} onChange={setClient} search={searchClients} placeholder="Rechercher un client" queryKey="clients" /></Field>
            ) : (
              <div className="space-y-3">
                <Field label="Nom" error={err("new_client.name")}><Input value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} placeholder="M. Fall, Entreprise Diallo BTP…" /></Field>
                <Field label="Téléphone (facultatif)" error={err("new_client.phone")} hint="Un client déjà connu avec ce numéro est retrouvé."><Input inputMode="tel" value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} /></Field>
              </div>
            )}
          </Panel>
          <Panel title="Total">
            <AmountRow label="Total HT" value={totals.ht} tone="muted" />
            <AmountRow label="TVA" value={totals.vat} tone="muted" />
            <AmountRow label="Total TTC" value={total} strong />
          </Panel>
          {canCollect && (
            <Panel title="Encaissement">
              <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={collect} onChange={(e) => setCollect(e.target.checked)} /> Encaisser maintenant</label>
              {collect && (
                <div className="space-y-3">
                  <MethodPicker value={method} onChange={setMethod} error={err("payment.method") ?? err("method")} />
                  <Field label="Montant reçu" error={err("amount") ?? err("payment.amount")} hint="Vide : le total"><MoneyInput value={amount} onChange={setAmount} /></Field>
                  {method !== "especes" && <Field label="Référence" error={err("payment.reference") ?? err("reference")} hint={referenceHint(method)}><Input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>}
                  {method === "especes" && amount !== "" && amount > total && <p className="text-sm font-medium">Monnaie à rendre : {cfa(amount - total)}</p>}
                </div>
              )}
            </Panel>
          )}
          <Button className="h-12 w-full text-base" disabled={!valid || mutation.isPending} onClick={() => mutation.mutate(undefined)}>Valider la vente · {cfa(total)}</Button>
        </aside>
      </div>
    </>
  );
}
