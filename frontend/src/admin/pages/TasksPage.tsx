import { useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "../auth";
import { useApiMutation } from "../hooks";
import type { Paginated, Task } from "../types";
import { TaskItem } from "../components/TaskItem";
import { useQuickCreate } from "../components/QuickCreate";
import { EmptyState, FilterChips, LoadingBlock, PageHeader, Panel } from "../components/ui";

type View = "open" | "done";

const presets = [
  { key: "today", label: "Aujourd'hui", at: () => { const d = new Date(); d.setHours(18, 0, 0, 0); return d; } },
  { key: "tomorrow", label: "Demain", at: () => { const d = new Date(Date.now() + 86_400_000); d.setHours(9, 0, 0, 0); return d; } },
  { key: "week", label: "Lundi prochain", at: () => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); d.setHours(9, 0, 0, 0); return d; } },
] as const;

function group(tasks: Task[]) {
  const startOfToday = new Date(new Date().toDateString()).getTime();
  const day = 86_400_000;
  const groups: Record<string, Task[]> = { "En retard": [], "Aujourd'hui": [], Demain: [], "Plus tard": [] };
  for (const t of tasks) {
    const due = new Date(t.due_at).getTime();
    if (t.is_overdue && due < startOfToday) groups["En retard"].push(t);
    else if (due < startOfToday + day) groups["Aujourd'hui"].push(t);
    else if (due < startOfToday + 2 * day) groups.Demain.push(t);
    else groups["Plus tard"].push(t);
  }
  return Object.entries(groups).filter(([, list]) => list.length);
}

export default function TasksPage() {
  const { isDirigeant } = useAuth();
  const quickCreate = useQuickCreate();
  const [view, setView] = useState<View>("open");
  const [team, setTeam] = useState(false);
  const [title, setTitle] = useState("");
  const [preset, setPreset] = useState<(typeof presets)[number]["key"]>("today");

  const query = { state: view, all: isDirigeant && team };
  const { data, isLoading } = useQuery({ queryKey: ["tasks", query], queryFn: () => api<Paginated<Task>>("/tasks", { query }) });
  const sections = useMemo(() => (data ? group(data.data) : []), [data]);

  const add = useApiMutation(
    () => api("/tasks", { method: "POST", body: { title, due_at: presets.find((p) => p.key === preset)!.at().toISOString() } }),
    { success: "Tâche ajoutée.", invalidate: [["tasks"], ["dashboard"]], onSuccess: () => setTitle("") },
  );

  const submit = (e: FormEvent) => { e.preventDefault(); if (title.trim()) add.mutate(undefined); };

  return (
    <>
      <PageHeader
        title="Tâches"
        description="Rappels, demandes du site à rappeler, biens à proposer à vos prospects."
        actions={<Button variant="outline" onClick={() => quickCreate.open("task")}><Plus className="h-4 w-4" /> Tâche détaillée</Button>}
      />

      <form onSubmit={submit} className="mb-6 rounded-xl border bg-card p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input className="border-0 bg-transparent text-base shadow-none focus-visible:ring-0" placeholder="Ajouter une tâche… ex. « Rappeler Mme Sow pour la visite »"
            value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="flex shrink-0 items-center gap-1">
            {presets.map((p) => (
              <button key={p.key} type="button" onClick={() => setPreset(p.key)}
                className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition", preset === p.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
                {p.label}
              </button>
            ))}
            <Button type="submit" size="sm" disabled={!title.trim() || add.isPending}>Ajouter</Button>
          </div>
        </div>
      </form>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterChips<View> value={view} onChange={setView} options={[{ value: "open", label: "À faire", count: view === "open" ? data?.meta.total : undefined }, { value: "done", label: "Terminées" }]} />
        {isDirigeant && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch checked={team} onCheckedChange={setTeam} /> Toute l'équipe
          </label>
        )}
      </div>

      {isLoading ? <LoadingBlock /> : !data?.data.length ? (
        <EmptyState icon={CheckCircle2} title={view === "done" ? "Aucune tâche terminée" : "Rien à faire, bravo"}>
          {view === "open" && "Ajoutez une tâche ci-dessus, ou laissez le site et les rapprochements vous en créer."}
        </EmptyState>
      ) : view === "done" ? (
        <Panel bodyClassName="divide-y p-2">{data.data.map((t) => <TaskItem key={t.id} task={t} showOwner={team} />)}</Panel>
      ) : (
        <div className="space-y-6">
          {sections.map(([label, list]) => (
            <section key={label}>
              <h2 className={cn("mb-2 flex items-center gap-2 text-sm font-semibold", label === "En retard" ? "text-red-600" : "text-foreground")}>
                {label} <span className="rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground">{list.length}</span>
              </h2>
              <Panel bodyClassName="divide-y p-2">{list.map((t) => <TaskItem key={t.id} task={t} showOwner={team} />)}</Panel>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
