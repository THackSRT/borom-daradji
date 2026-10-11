import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, UserPlus, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApiMutation } from "../../hooks";
import type { Paginated, Worker, Worksite, WorksiteTeam } from "../../types";
import { cfa, MoneyInput } from "../billing";
import { Field, FormError, Panel, StatusBadge } from "../ui";
import { WorkerPaymentDialog } from "./WorkerPaymentDialog";

const today = () => new Date().toLocaleDateString("en-CA");

/** Onglet « Équipe » : pointage du jour, situation des tâcherons sur ce chantier, travaux à la tâche. */
export function TeamTab({ worksite }: { worksite: Worksite }) {
  const [date, setDate] = useState(today());
  const [paying, setPaying] = useState<{ id: number; name: string; balance: number } | null>(null);
  const [newTask, setNewTask] = useState(false);
  const { data: team } = useQuery({
    queryKey: ["worksite-team", worksite.id, date],
    queryFn: () => api<{ data: WorksiteTeam }>(`/worksites/${worksite.id}/team`, { query: { date } }).then((r) => r.data),
  });
  const open = ["planifie", "en_cours", "suspendu"].includes(worksite.status.value);
  const taskAction = useApiMutation(({ id, action }: { id: number; action: string }) => api(`/worksites/${worksite.id}/tasks/${id}`, { method: "PUT", body: { action } }), {
    success: "Tâche mise à jour.", invalidate: [["worksite-team", worksite.id], ["worksite-budget", worksite.id]],
  });

  if (!team) return <Panel><p className="text-sm text-muted-foreground">Chargement…</p></Panel>;

  return (
    <div className="space-y-4">
      {team.can.team && open && <AttendancePanel worksite={worksite} team={team} date={date} setDate={setDate} />}

      <Panel title="Tâcherons du chantier" bodyClassName="p-0">
        {!team.crew.length ? (
          <p className="p-5 text-sm text-muted-foreground">Personne n'a encore été pointé ni payé sur ce chantier.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Tâcheron</TableHead>
                <TableHead className="text-right">J.</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Dû ici</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Versé ici</TableHead>
                <TableHead className="text-right">Solde</TableHead>
                {team.can.pay && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.crew.map((c) => (
                <TableRow key={c.worker.id}>
                  <TableCell>
                    <Link to={`/admin/tacherons/${c.worker.id}`} className="font-medium hover:underline">{c.worker.name}</Link>
                    <p className="text-xs text-muted-foreground">{c.worker.trade ?? "—"}</p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">{c.days.toLocaleString("fr-FR")}</TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">{cfa(c.earned)}</TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">{cfa(c.paid)}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", c.balance > 0 && "font-medium text-red-600", c.balance < 0 && "text-amber-700")}
                    title="Tous chantiers confondus : positif = reste à payer, négatif = avance à couvrir">
                    {cfa(c.balance)}
                  </TableCell>
                  {team.can.pay && (
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setPaying({ id: c.worker.id, name: c.worker.name, balance: c.balance })}><Wallet className="h-4 w-4" /><span className="hidden sm:inline">Payer</span></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {team.can.pay && <p className="border-t px-5 py-2 text-xs text-muted-foreground">Solde tous chantiers confondus : positif = reste à payer ; négatif = avance pas encore couverte par du travail.</p>}
      </Panel>

      <Panel title="Travaux à la tâche" bodyClassName="p-0"
        action={team.can.team && open && <Button size="sm" variant="outline" onClick={() => setNewTask(true)}><Plus className="h-4 w-4" /> Nouvelle tâche</Button>}>
        {!team.tasks.length ? (
          <p className="p-5 text-sm text-muted-foreground">Aucun travail à la tâche. Exemple : « carrelage de la cuisine, 150 000 », dû une fois terminé.</p>
        ) : (
          <ul className="divide-y">
            {team.tasks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <p className={cn("font-medium", t.status.value === "annulee" && "text-muted-foreground line-through")}>{t.description}</p>
                  <p className="text-xs text-muted-foreground">{t.worker.name}{t.completed_on && ` · terminée le ${formatDate(t.completed_on)}`}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="tabular-nums">{cfa(t.amount)}</span>
                  <StatusBadge option={t.status} />
                  {team.can.team && t.status.value === "en_cours" && (
                    <>
                      <Button size="sm" variant="outline" disabled={taskAction.isPending} onClick={() => taskAction.mutate({ id: t.id, action: "terminer" })}><Check className="h-4 w-4" /> Terminée</Button>
                      <Button size="icon" variant="ghost" title="Annuler la tâche" disabled={taskAction.isPending} onClick={() => taskAction.mutate({ id: t.id, action: "annuler" })}><X className="h-4 w-4" /></Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <FormError message={taskAction.error?.field("task")} />
      </Panel>

      {paying && <WorkerPaymentDialog worker={paying} worksite={open ? worksite : null} open onOpenChange={(o) => !o && setPaying(null)} />}
      {newTask && <TaskDialog worksite={worksite} onClose={() => setNewTask(false)} />}
    </div>
  );
}

function useActiveWorkers() {
  return useQuery({
    queryKey: ["workers", "actifs"],
    queryFn: () => api<Paginated<Worker>>("/workers", { query: { per_page: 200 } }).then((r) => r.data),
  });
}

type Presence = 0 | 0.5 | 1;

function AttendancePanel({ worksite, team, date, setDate }: { worksite: Worksite; team: WorksiteTeam; date: string; setDate: (d: string) => void }) {
  const queryClient = useQueryClient();
  const { data: workers = [] } = useActiveWorkers();
  const [search, setSearch] = useState("");
  const recorded = useMemo(() => new Map(team.attendances.map((a) => [a.worker.id, a])), [team.attendances]);
  const [presence, setPresence] = useState<Record<number, Presence>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Repart du pointage enregistré à chaque changement de jour.
  useEffect(() => {
    setPresence(Object.fromEntries(team.attendances.map((a) => [a.worker.id, a.days as Presence])));
  }, [team.attendances]);

  // Tâcherons déjà pointés (même désactivés depuis) + tâcherons actifs ; à la journée d'abord.
  const list = useMemo(() => {
    const byId = new Map<number, { id: number; name: string; trade: string | null; rate: number; daily: boolean }>();
    team.attendances.forEach((a) => byId.set(a.worker.id, { id: a.worker.id, name: a.worker.name, trade: null, rate: a.daily_rate, daily: true }));
    workers.forEach((w) => byId.set(w.id, { id: w.id, name: w.name, trade: w.trade?.name ?? null, rate: w.daily_rate, daily: w.pay_type.value === "journalier" }));
    const q = search.trim().toLowerCase();
    return [...byId.values()]
      .filter((w) => !q || w.name.toLowerCase().includes(q) || (w.trade ?? "").toLowerCase().includes(q))
      .sort((a, b) => Number(b.daily) - Number(a.daily) || a.name.localeCompare(b.name, "fr"));
  }, [workers, team.attendances, search]);

  const changes = list.filter((w) => (presence[w.id] ?? 0) !== (recorded.get(w.id)?.days ?? 0));
  const present = Object.values(presence).filter((p) => p > 0);
  const total = list.reduce((sum, w) => sum + Math.round((presence[w.id] ?? 0) * (recorded.get(w.id)?.daily_rate ?? w.rate)), 0);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const entries = changes.filter((w) => (presence[w.id] ?? 0) > 0).map((w) => ({ worker_id: w.id, days: presence[w.id] }));
      if (entries.length) await api(`/worksites/${worksite.id}/attendances`, { method: "POST", body: { worked_on: date, entries } });
      for (const w of changes.filter((c) => (presence[c.id] ?? 0) === 0)) {
        const line = recorded.get(w.id);
        if (line) await api(`/worksites/${worksite.id}/attendances/${line.id}`, { method: "DELETE" });
      }
      toast.success("Pointage enregistré.");
      queryClient.invalidateQueries({ queryKey: ["worksite-team", worksite.id] });
      queryClient.invalidateQueries({ queryKey: ["worksite-budget", worksite.id] });
    } catch (e) {
      const message = e instanceof ApiError ? (e.field("worked_on") ?? e.field("worksite") ?? e.message) : "Enregistrement impossible.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Pointage" action={
      <Input type="date" className="h-8 w-40" value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} />
    }>
      {!list.length && !search ? (
        <p className="text-sm text-muted-foreground">Aucun tâcheron enregistré. <Link className="font-medium underline" to="/admin/tacherons">Ajoutez votre équipe</Link> pour pointer.</p>
      ) : (
        <>
          {list.length > 8 || search ? <Input placeholder="Chercher un tâcheron ou un métier…" className="mb-3" value={search} onChange={(e) => setSearch(e.target.value)} /> : null}
          <ul className="divide-y rounded-lg border">
            {list.map((w) => {
              const value = presence[w.id] ?? 0;
              return (
                <li key={w.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-medium">{w.name}</p>
                    <p className="text-xs text-muted-foreground">{[w.trade, w.daily ? `${cfa(recorded.get(w.id)?.daily_rate ?? w.rate)}/jour` : "à la tâche"].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="flex shrink-0 overflow-hidden rounded-md border text-xs font-medium">
                    {([0, 0.5, 1] as Presence[]).map((p) => (
                      <button key={p} type="button" onClick={() => setPresence((s) => ({ ...s, [w.id]: p }))}
                        className={cn("px-2.5 py-1.5 transition", value === p ? (p === 0 ? "bg-muted text-foreground" : "bg-primary text-primary-foreground") : "hover:bg-muted")}>
                        {p === 0 ? "Absent" : p === 0.5 ? "½ j" : "Journée"}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
          <FormError message={error} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">{present.length} présent{present.length > 1 ? "s" : ""} le {formatDate(date)} · {cfa(total)}</span>
            <Button onClick={save} disabled={!changes.length || saving}>{saving ? "Enregistrement…" : `Enregistrer le pointage${changes.length ? ` (${changes.length})` : ""}`}</Button>
          </div>
        </>
      )}
    </Panel>
  );
}

function TaskDialog({ worksite, onClose }: { worksite: Worksite; onClose: () => void }) {
  const { data: workers = [] } = useActiveWorkers();
  const [workerId, setWorkerId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const mutation = useApiMutation(() => api(`/worksites/${worksite.id}/tasks`, { method: "POST", body: { worker_id: Number(workerId), description, amount: amount || 0 } }), {
    success: "Tâche ajoutée.", invalidate: [["worksite-team", worksite.id]], onSuccess: onClose,
  });
  const err = (f: string) => mutation.error?.field(f);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Travail à la tâche</DialogTitle>
          <DialogDescription>Prix convenu avec le tâcheron ; il lui sera dû quand la tâche sera marquée terminée.</DialogDescription>
        </DialogHeader>
        <Field label="Tâcheron" error={err("worker_id")}>
          {workers.length ? (
            <Select value={workerId} onValueChange={setWorkerId}>
              <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
              <SelectContent>{workers.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}{w.trade ? ` — ${w.trade.name}` : ""}</SelectItem>)}</SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground"><UserPlus className="mr-1 inline h-4 w-4" /><Link className="underline" to="/admin/tacherons">Ajoutez d'abord un tâcheron.</Link></p>
          )}
        </Field>
        <Field label="Travail" error={err("description")}><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Carrelage de la cuisine" /></Field>
        <Field label="Prix convenu" error={err("amount")}><MoneyInput value={amount} onChange={setAmount} /></Field>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={() => mutation.mutate(undefined)} disabled={!workerId || !description.trim() || !amount || mutation.isPending}>Ajouter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
