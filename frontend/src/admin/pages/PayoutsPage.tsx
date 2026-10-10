import { useState, type FormEvent } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Ban, Download, HandCoins, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, downloadFile } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth } from "../auth";
import { useApiMutation, useOptions } from "../hooks";
import type { OwnerPayoutRow, OwnerStatement } from "../types";
import { AmountRow, cfa, MoneyInput } from "../components/billing";
import { EmptyState, Field, FormError, LoadingBlock, PageHeader } from "../components/ui";

interface OwnerRow {
  id: number;
  name: string;
  phone: string | null;
  managed_leases: number;
  pending_collected: number;
  pending_net: number;
  last_payout: { number: string; paid_on: string; net: number } | null;
}

const tabClass = "rounded-lg border border-transparent px-3 py-1.5 data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:shadow-sm";
const thisMonth = () => new Date().toISOString().slice(0, 7);

export default function PayoutsPage() {
  const [period, setPeriod] = useState(thisMonth());
  const [owner, setOwner] = useState<OwnerRow | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["owner-payouts", "owners", period],
    queryFn: () => api<{ data: OwnerRow[] }>("/owner-payouts/owners", { query: { period } }).then((r) => r.data),
    placeholderData: keepPreviousData,
  });
  const totalNet = data?.reduce((s, o) => s + o.pending_net, 0) ?? 0;

  return (
    <>
      <PageHeader title="Reversements" description="Ce qui revient à chaque propriétaire : loyers encaissés sur ses baux en gestion, moins la commission de l'agence." />
      <Tabs defaultValue="a-verser">
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
          <TabsTrigger value="a-verser" className={tabClass}>À reverser</TabsTrigger>
          <TabsTrigger value="historique" className={tabClass}>Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="a-verser" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Field label="Encaissements jusqu'à la fin de"><Input type="month" className="w-48 bg-card" value={period} onChange={(e) => setPeriod(e.target.value || thisMonth())} /></Field>
            <p className="text-sm text-muted-foreground">Total à reverser : <strong className="tabular-nums text-foreground">{cfa(totalNet)}</strong></p>
          </div>
          {isLoading ? <LoadingBlock /> : !data?.length ? (
            <EmptyState icon={HandCoins} title="Aucun propriétaire en gestion">Cochez « Bail en gestion » sur un bail pour que ses loyers soient reversés ici.</EmptyState>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Propriétaire</TableHead>
                    <TableHead className="hidden md:table-cell">Baux gérés</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Encaissé</TableHead>
                    <TableHead className="text-right">Net à reverser</TableHead>
                    <TableHead className="hidden lg:table-cell">Dernier reversement</TableHead>
                    <TableHead className="w-32" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.name}<span className="block text-xs font-normal text-muted-foreground">{o.phone}</span></TableCell>
                      <TableCell className="hidden md:table-cell">{o.managed_leases}</TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">{cfa(o.pending_collected)}</TableCell>
                      <TableCell className={cn("text-right font-semibold tabular-nums", !o.pending_net && "font-normal text-muted-foreground")}>{cfa(o.pending_net)}</TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{o.last_payout ? `${formatDate(o.last_payout.paid_on)} · ${cfa(o.last_payout.net)}` : "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant={o.pending_net ? "default" : "outline"} disabled={!o.pending_collected} onClick={() => setOwner(o)}>Relevé</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="historique" className="mt-4"><History /></TabsContent>
      </Tabs>

      {owner && <StatementSheet owner={owner} period={period} onClose={() => setOwner(null)} />}
    </>
  );
}

function StatementSheet({ owner, period, onClose }: { owner: OwnerRow; period: string; onClose: () => void }) {
  const { can } = useAuth();
  const methods = useOptions("payment_methods");
  const { data: statement, isLoading } = useQuery({
    queryKey: ["owner-statement", owner.id, period],
    queryFn: () => api<{ data: OwnerStatement }>(`/owners/${owner.id}/statement`, { query: { period } }).then((r) => r.data),
  });
  const [expenses, setExpenses] = useState<{ label: string; amount: number | "" }[]>([]);
  const [method, setMethod] = useState("virement");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const expensesTotal = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const net = (statement?.net_before_expenses ?? 0) - expensesTotal;

  const mutation = useApiMutation(
    () => api<{ data: OwnerPayoutRow }>(`/owners/${owner.id}/payouts`, {
      method: "POST",
      body: { period, method, reference: reference || null, paid_on: paidOn, expenses: expenses.filter((e) => e.label && e.amount).map((e) => ({ label: e.label, amount: Number(e.amount) })) },
    }),
    {
      success: "Reversement enregistré.",
      invalidate: [["owner-payouts"]],
      onSuccess: (r) => { downloadFile(`/owner-payouts/${r.data.id}/pdf`, `${r.data.number}.pdf`); onClose(); },
    },
  );
  const submit = (e: FormEvent) => { e.preventDefault(); mutation.mutate(undefined); };
  const err = (f: string) => mutation.error?.field(f);

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Relevé de {owner.name}</SheetTitle>
          <SheetDescription>Loyers encaissés et pas encore reversés, jusqu'à la fin de {formatDate(`${period}-01`, "MMMM yyyy")}.</SheetDescription>
        </SheetHeader>
        {isLoading || !statement ? <div className="mt-6"><LoadingBlock rows={3} /></div> : (
          <form onSubmit={submit} className="mt-5 space-y-5">
            <FormError message={err("period")} />
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground"><th className="px-3 py-2 font-medium">Bien · mois</th><th className="px-3 py-2 text-right font-medium">Encaissé</th><th className="px-3 py-2 text-right font-medium">Commission</th></tr></thead>
                <tbody>
                  {statement.lines.map((l) => (
                    <tr key={l.payment_id} className="border-b last:border-0">
                      <td className="px-3 py-2"><span className="font-medium">{l.month}</span> · {l.property}<span className="block text-xs text-muted-foreground">{l.tenant} · {l.receipt} du {formatDate(l.paid_on)}</span></td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{cfa(l.amount)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-muted-foreground">{cfa(l.commission)}<span className="block text-xs">{l.commission_rate} %</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">Frais déduits (facultatif)</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setExpenses([...expenses, { label: "", amount: "" }])}><Plus className="h-4 w-4" /> Ajouter un frais</Button>
              </div>
              {expenses.map((e, i) => (
                <div key={i} className="mb-2 flex gap-2">
                  <Input placeholder="Ex. réparation plomberie" value={e.label} onChange={(ev) => setExpenses(expenses.map((x, j) => (j === i ? { ...x, label: ev.target.value } : x)))} />
                  <div className="w-44 shrink-0"><MoneyInput value={e.amount} onChange={(amount) => setExpenses(expenses.map((x, j) => (j === i ? { ...x, amount } : x)))} /></div>
                  <Button type="button" variant="ghost" size="icon" aria-label="Retirer" onClick={() => setExpenses(expenses.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              {err("expenses") && <p className="text-xs font-medium text-destructive">{err("expenses")}</p>}
            </div>

            <div className="rounded-lg border bg-muted/20 p-4">
              <AmountRow label="Loyers encaissés" value={statement.collected} />
              <AmountRow label="Commission de gestion" value={-statement.commission} tone="muted" />
              {statement.commission_vat > 0 && <AmountRow label="TVA sur commission" value={-statement.commission_vat} tone="muted" />}
              {expensesTotal > 0 && <AmountRow label="Frais" value={-expensesTotal} tone="muted" />}
              <div className="my-1.5 border-t" />
              <AmountRow label="Net à reverser" value={net} strong tone={net < 0 ? "red" : undefined} />
            </div>

            {can("payouts.manage") && (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Versé par" error={err("method")}>
                    <Select value={method} onValueChange={setMethod}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{methods.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Référence" htmlFor="po-ref" error={err("reference")}><Input id="po-ref" value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
                  <Field label="Date" htmlFor="po-date" error={err("paid_on")}><Input id="po-date" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} /></Field>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={onClose}>Fermer</Button>
                  <Button type="submit" disabled={mutation.isPending || net < 0}><HandCoins className="h-4 w-4" /> Enregistrer le versement de {cfa(net)}</Button>
                </div>
              </>
            )}
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

function History() {
  const { can } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["owner-payouts", "history"],
    queryFn: () => api<{ data: OwnerPayoutRow[] }>("/owner-payouts").then((r) => r.data),
  });
  const cancel = useApiMutation((p: { id: number; reason: string }) => api(`/owner-payouts/${p.id}/cancel`, { method: "POST", body: { reason: p.reason } }), {
    success: "Reversement annulé : les loyers sont de nouveau à reverser.", invalidate: [["owner-payouts"]],
  });
  if (isLoading) return <LoadingBlock />;
  if (!data?.length) return <EmptyState icon={HandCoins} title="Aucun reversement pour l'instant" compact>Ils apparaîtront ici, avec leur relevé PDF.</EmptyState>;
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead>Numéro</TableHead>
            <TableHead>Propriétaire</TableHead>
            <TableHead className="hidden md:table-cell">Versé le</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Encaissé</TableHead>
            <TableHead className="text-right">Net</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((p) => (
            <TableRow key={p.id} className={cn(p.cancelled_at && "opacity-60")}>
              <TableCell className="font-medium">{p.number}{p.cancelled_at && <span className="block text-xs font-normal text-red-600">Annulé : {p.cancel_reason}</span>}</TableCell>
              <TableCell>{p.owner.name}</TableCell>
              <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{formatDate(p.paid_on)} · {p.method.label}</TableCell>
              <TableCell className="hidden text-right tabular-nums sm:table-cell">{cfa(p.collected)}</TableCell>
              <TableCell className={cn("text-right font-medium tabular-nums", p.cancelled_at && "line-through")}>{cfa(p.net)}</TableCell>
              <TableCell>
                <div className="flex justify-end">
                  <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Relevé PDF" onClick={() => downloadFile(`/owner-payouts/${p.id}/pdf`, `${p.number}.pdf`)}><Download className="h-4 w-4" /></Button>
                  {can("payouts.manage") && !p.cancelled_at && (
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label="Annuler"
                      onClick={() => { const reason = window.prompt("Motif de l'annulation ?"); if (reason) cancel.mutate({ id: p.id, reason }); }}><Ban className="h-4 w-4" /></Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
