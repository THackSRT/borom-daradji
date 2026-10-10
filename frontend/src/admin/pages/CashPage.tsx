import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Banknote, CheckCircle2, Lock, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth } from "../auth";
import { useApiMutation, useOptions } from "../hooks";
import type { CashSession, Paginated, Payment } from "../types";
import { AmountRow, cfa, MoneyInput } from "../components/billing";
import { EmptyState, Field, FormError, LoadingBlock, PageHeader, Pagination, Panel } from "../components/ui";

const tabClass = "rounded-lg border border-transparent px-3 py-1.5 data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:shadow-sm";

export default function CashPage() {
  const { hasRole } = useAuth();
  const team = hasRole("comptable");
  return (
    <>
      <PageHeader title="Caisse" description="Espèces du jour, encaissements par mode de paiement, clôture." />
      <Tabs defaultValue="jour">
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
          <TabsTrigger value="jour" className={tabClass}>Ma caisse du jour</TabsTrigger>
          <TabsTrigger value="encaissements" className={tabClass}>Encaissements</TabsTrigger>
          {team && <TabsTrigger value="equipe" className={tabClass}>Caisses de l'équipe</TabsTrigger>}
        </TabsList>
        <TabsContent value="jour" className="mt-4"><TodayTill /></TabsContent>
        <TabsContent value="encaissements" className="mt-4"><PaymentsList team={team} /></TabsContent>
        {team && <TabsContent value="equipe" className="mt-4"><TeamTills /></TabsContent>}
      </Tabs>
    </>
  );
}

function useSession(id?: number) {
  return useQuery({
    queryKey: ["cash-session", id ?? "current"],
    queryFn: () => api<{ data: CashSession }>(id ? `/cash-sessions/${id}` : "/cash-sessions/current").then((r) => r.data),
  });
}

function TodayTill() {
  const { data: session, isLoading } = useSession();
  if (isLoading || !session) return <LoadingBlock />;
  return <TillDetail session={session} editable />;
}

/** Détail d'une caisse : théorique, encaissements, mouvements, clôture. */
function TillDetail({ session, editable = false }: { session: CashSession; editable?: boolean }) {
  const [closing, setClosing] = useState(false);
  const [moving, setMoving] = useState(false);
  const closed = !!session.closed_at;
  const invalidate = [["cash-session"]];
  const [opening, setOpening] = useState<number | "">("");
  const open = useApiMutation(() => api("/cash-sessions/current", { method: "PUT", body: { opening_amount: opening || 0 } }), {
    success: "Fonds de caisse enregistré.", invalidate, onSuccess: () => setOpening(""),
  });
  const cashPayments = session.payments?.filter((p) => p.method.value === "especes") ?? [];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        <section className={cn("rounded-xl border p-5 shadow-sm", closed ? "bg-slate-50" : "bg-card")}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{session.user?.name} · {formatDate(session.date, "EEEE d MMMM yyyy")}</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{closed ? "Compté à la clôture" : "Espèces attendues en caisse"}</p>
              <p className="text-4xl font-semibold tabular-nums">{cfa(closed ? session.counted_amount ?? 0 : session.expected_amount)}</p>
              {closed && session.difference !== null && (
                <p className={cn("mt-1 text-sm font-medium", session.difference === 0 ? "text-emerald-700" : "text-red-600")}>
                  {session.difference === 0 ? "Aucun écart" : `Écart : ${session.difference > 0 ? "+" : ""}${cfa(session.difference)}`}
                  <span className="font-normal text-muted-foreground"> (attendu {cfa(session.expected_amount)})</span>
                </p>
              )}
            </div>
            {closed ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-3 py-1 text-sm font-medium text-slate-700"><Lock className="h-3.5 w-3.5" /> Clôturée {formatDateTime(session.closed_at)}</span>
            ) : (
              <div className="flex flex-wrap gap-2">
                {editable && <Button variant="outline" onClick={() => setMoving(true)}><Plus className="h-4 w-4" /> Mouvement</Button>}
                <Button onClick={() => setClosing(true)}><CheckCircle2 className="h-4 w-4" /> Clôturer la caisse</Button>
              </div>
            )}
          </div>
          {closed && session.closing_note && <p className="mt-3 rounded-lg bg-white px-3 py-2 text-sm text-muted-foreground">« {session.closing_note} »</p>}
          <div className="mt-5 grid gap-x-8 sm:grid-cols-2">
            <div>
              <AmountRow label="Fonds de caisse" value={session.opening_amount} tone="muted" />
              <AmountRow label={`Espèces encaissées (${cashPayments.filter((p) => !p.cancelled_at).length})`} value={session.cash_in} tone="green" />
              <AmountRow label="Mouvements" value={session.movements_total} tone={session.movements_total < 0 ? "red" : "muted"} />
            </div>
            {editable && !closed && (
              <form className="mt-3 flex items-end gap-2 sm:mt-0" onSubmit={(e) => { e.preventDefault(); open.mutate(undefined); }}>
                <Field label="Fonds de caisse du matin" className="flex-1" error={open.error?.field("opening_amount")}>
                  <MoneyInput value={opening} onChange={setOpening} />
                </Field>
                <Button type="submit" variant="outline" disabled={opening === "" || open.isPending}>Enregistrer</Button>
              </form>
            )}
          </div>
        </section>

        <Panel title="Espèces encaissées" description="Annuler un encaissement se fait depuis sa facture, avant la clôture.">
          {!cashPayments.length ? <p className="text-sm text-muted-foreground">Aucun encaissement en espèces aujourd'hui.</p> : <PaymentRows payments={cashPayments} />}
        </Panel>

        <Panel title="Mouvements" description="Fonds de caisse, dépôts en banque, petites dépenses, remises au dirigeant.">
          {!session.movements?.length ? <p className="text-sm text-muted-foreground">Aucun mouvement.</p> : (
            <ul className="divide-y">
              {session.movements.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    {m.amount > 0 ? <ArrowDownLeft className="h-4 w-4 shrink-0 text-emerald-600" /> : <ArrowUpRight className="h-4 w-4 shrink-0 text-red-600" />}
                    <span className="min-w-0"><span className="block truncate font-medium">{m.label}</span><span className="text-xs text-muted-foreground">{m.type.label} · {formatDateTime(m.created_at)}</span></span>
                  </span>
                  <span className={cn("shrink-0 tabular-nums", m.amount < 0 ? "text-red-600" : "text-emerald-700")}>{m.amount > 0 ? "+" : ""}{cfa(m.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <aside className="space-y-4">
        <Panel title="Hors espèces" description="À rapprocher des relevés Wave, Orange Money et de la banque.">
          {!session.other_methods?.length ? <p className="text-sm text-muted-foreground">Rien aujourd'hui.</p> : (
            session.other_methods.map((m) => <AmountRow key={m.method.value} label={`${m.method.label} (${m.count})`} value={m.total} />)
          )}
        </Panel>
        <Panel title="Comment ça marche">
          <ol className="list-decimal space-y-1.5 pl-4 text-sm text-muted-foreground">
            <li>Le matin, saisissez le fonds de caisse.</li>
            <li>Chaque encaissement en espèces s'ajoute automatiquement.</li>
            <li>Notez les sorties : dépôt en banque, dépense, remise au dirigeant.</li>
            <li>Le soir, comptez les billets et clôturez. Un écart doit être expliqué.</li>
          </ol>
        </Panel>
      </aside>

      <CloseDialog session={session} open={closing} onOpenChange={setClosing} />
      {editable && <MovementDialog open={moving} onOpenChange={setMoving} available={session.expected_amount} />}
    </div>
  );
}

function PaymentRows({ payments }: { payments: Payment[] }) {
  return (
    <ul className="divide-y">
      {payments.map((p) => (
        <li key={p.id} className={cn("flex items-center justify-between gap-3 py-2.5 text-sm", p.cancelled_at && "opacity-60")}>
          <span className="min-w-0">
            <span className="block truncate font-medium">{p.client?.name}</span>
            <span className="text-xs text-muted-foreground">
              {p.number} · {p.invoice && <Link className="hover:underline" to={`/admin/factures/${p.invoice.id}`}>{p.invoice.number}</Link>}
              {p.cancelled_at && <span className="text-red-600"> · annulé</span>}
            </span>
          </span>
          <span className={cn("shrink-0 tabular-nums", p.cancelled_at && "line-through")}>{cfa(p.amount)}</span>
        </li>
      ))}
    </ul>
  );
}

function CloseDialog({ session, open, onOpenChange }: { session: CashSession; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [counted, setCounted] = useState<number | "">("");
  const [note, setNote] = useState("");
  const difference = counted === "" ? null : counted - session.expected_amount;
  const mutation = useApiMutation(() => api(`/cash-sessions/${session.id}/close`, { method: "POST", body: { counted_amount: counted || 0, closing_note: note || null } }), {
    success: "Caisse clôturée.", invalidate: [["cash-session"], ["cash-sessions"]], onSuccess: () => onOpenChange(false),
  });
  const submit = (e: FormEvent) => { e.preventDefault(); mutation.mutate(undefined); };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Clôturer la caisse</DialogTitle>
            <DialogDescription>Comptez les billets et pièces, puis saisissez le total. Attendu : {cfa(session.expected_amount)}.</DialogDescription>
          </DialogHeader>
          <FormError message={mutation.error?.field("session")} />
          <Field label="Montant compté" error={mutation.error?.field("counted_amount")}>
            <MoneyInput value={counted} onChange={setCounted} autoFocus />
          </Field>
          {difference !== null && (
            <p className={cn("rounded-lg px-3 py-2 text-sm font-medium", difference === 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
              {difference === 0 ? "Le compte est bon." : `Écart de ${difference > 0 ? "+" : ""}${cfa(difference)} : expliquez-le ci-dessous.`}
            </p>
          )}
          <Field label="Explication" htmlFor="closing-note" error={mutation.error?.field("closing_note")}>
            <Textarea id="closing-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={difference ? "Ex. monnaie rendue en trop" : "Facultatif"} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={counted === "" || mutation.isPending}><Lock className="h-4 w-4" /> Clôturer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MovementDialog({ open, onOpenChange, available }: { open: boolean; onOpenChange: (open: boolean) => void; available: number }) {
  const types = useOptions("cash_movement_types");
  const [type, setType] = useState("depot_banque");
  const [amount, setAmount] = useState<number | "">("");
  const [label, setLabel] = useState("");
  const mutation = useApiMutation(() => api("/cash-sessions/current/movements", { method: "POST", body: { type, amount: amount || 0, label } }), {
    success: "Mouvement enregistré.", invalidate: [["cash-session"]],
    onSuccess: () => { setAmount(""); setLabel(""); onOpenChange(false); },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(undefined); }} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Mouvement de caisse</DialogTitle>
            <DialogDescription>Entrée ou sortie d'espèces sans facture. En caisse : {cfa(available)}.</DialogDescription>
          </DialogHeader>
          <FormError message={mutation.error?.field("session")} />
          <Field label="Type" error={mutation.error?.field("type")}>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{types.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Montant" error={mutation.error?.field("amount")}><MoneyInput value={amount} onChange={setAmount} /></Field>
          <Field label="Libellé" htmlFor="mv-label" error={mutation.error?.field("label")}>
            <Input id="mv-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. dépôt CBAO bordereau 1234" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={mutation.isPending}>Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PaymentsList({ team }: { team: boolean }) {
  const methods = useOptions("payment_methods");
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [method, setMethod] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const query = { from, to, method: method === "all" ? undefined : method, search, page };
  const { data, isLoading } = useQuery({
    queryKey: ["payments", query],
    queryFn: () => api<Paginated<Payment> & { summary: { total: number; by_method: { method: { value: string; label: string }; total: number; count: number }[] } }>("/payments", { query }),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Du"><Input type="date" className="bg-card" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} /></Field>
        <Field label="Au"><Input type="date" className="bg-card" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} /></Field>
        <Field label="Mode">
          <Select value={method} onValueChange={(v) => { setMethod(v); setPage(1); }}>
            <SelectTrigger className="w-44 bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les modes</SelectItem>
              {methods.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="bg-card pl-9" placeholder="Reçu, référence, client" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      {data && (
        <div className="flex flex-wrap gap-2">
          <span className="rounded-lg border bg-card px-3 py-2 text-sm"><span className="text-muted-foreground">Total </span><strong className="tabular-nums">{cfa(data.summary.total)}</strong></span>
          {data.summary.by_method.map((m) => (
            <span key={m.method.value} className="rounded-lg border bg-card px-3 py-2 text-sm"><span className="text-muted-foreground">{m.method.label} ({m.count}) </span><span className="tabular-nums">{cfa(m.total)}</span></span>
          ))}
        </div>
      )}

      {isLoading ? <LoadingBlock /> : !data?.data.length ? (
        <EmptyState icon={Banknote} title="Aucun encaissement sur la période" compact>{team ? "Tous les encaissements de l'équipe s'affichent ici." : "Vos encaissements s'affichent ici."}</EmptyState>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="hidden md:table-cell">Facture</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead className="hidden lg:table-cell">Reçu par</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((p) => (
                  <TableRow key={p.id} className={cn(p.cancelled_at && "opacity-60")}>
                    <TableCell className="whitespace-nowrap text-sm">{formatDate(p.paid_on, "d MMM")}</TableCell>
                    <TableCell className="max-w-[10rem] truncate">{p.client?.name}</TableCell>
                    <TableCell className="hidden md:table-cell">{p.invoice && <Link className="text-primary hover:underline" to={`/admin/factures/${p.invoice.id}`}>{p.invoice.number}</Link>}</TableCell>
                    <TableCell className="text-sm">{p.method.label}{p.reference && <span className="block text-xs text-muted-foreground">{p.reference}</span>}</TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{p.received_by?.name}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", p.cancelled_at && "line-through")}>{cfa(p.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onChange={setPage} />
        </>
      )}
    </div>
  );
}

function TeamTills() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [selected, setSelected] = useState<number | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["cash-sessions", date],
    queryFn: () => api<Paginated<CashSession>>("/cash-sessions", { query: { date } }),
  });
  const detail = useSession(selected ?? undefined);

  if (selected && detail.data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>← Toutes les caisses</Button>
        <TillDetail session={detail.data} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Field label="Jour"><Input type="date" className="w-48 bg-card" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      {isLoading ? <LoadingBlock /> : !data?.data.length ? (
        <EmptyState icon={Banknote} title="Aucune caisse ce jour-là" compact>Une caisse s'ouvre au premier encaissement en espèces.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Personne</TableHead>
                <TableHead className="text-right">Espèces encaissées</TableHead>
                <TableHead className="text-right">Attendu</TableHead>
                <TableHead className="text-right">Écart</TableHead>
                <TableHead>État</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((s) => (
                <TableRow key={s.id} className="cursor-pointer" onClick={() => setSelected(s.id)}>
                  <TableCell className="font-medium">{s.user?.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{cfa(s.cash_in)}</TableCell>
                  <TableCell className="text-right tabular-nums">{cfa(s.expected_amount)}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", s.difference ? "font-medium text-red-600" : "text-muted-foreground")}>{s.difference === null ? "—" : cfa(s.difference)}</TableCell>
                  <TableCell>{s.closed_at ? <span className="inline-flex items-center gap-1 text-sm text-slate-600"><Lock className="h-3.5 w-3.5" /> Clôturée</span> : <span className="text-sm font-medium text-amber-700">Ouverte</span>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
