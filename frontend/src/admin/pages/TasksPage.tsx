import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { formatDateTime, fromNow } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth } from "../auth";
import { useApiMutation, useOptions } from "../hooks";
import type { Paginated, Task, User } from "../types";
import { EmptyState, Field, LoadingBlock, PageHeader, StatusBadge, WhatsAppLink } from "../components/ui";

type Filter = "today" | "week" | "all" | "done";

export default function TasksPage() {
  const { user, isDirigeant } = useAuth();
  const [filter, setFilter] = useState<Filter>("today");
  const [team, setTeam] = useState(false);
  const [creating, setCreating] = useState(false);

  const query = {
    due: filter === "today" || filter === "week" ? filter : undefined,
    state: filter === "done" ? "done" : "open",
    all: isDirigeant && team,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["tasks", query],
    queryFn: () => api<Paginated<Task>>("/tasks", { query }),
  });

  const toggle = useApiMutation(
    ({ id, done }: { id: number; done: boolean }) => api(`/tasks/${id}`, { method: "PUT", body: { done } }),
    { invalidate: [["tasks"]] },
  );

  return (
    <>
      <PageHeader
        title={`Bonjour ${user?.name.split(" ")[0] ?? ""}`}
        description="Vos rappels, demandes du site et biens à proposer."
        actions={
          <Button variant="gold" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Nouvelle tâche
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList className="flex h-auto flex-wrap justify-start">
            <TabsTrigger value="today">Aujourd'hui</TabsTrigger>
            <TabsTrigger value="week">Cette semaine</TabsTrigger>
            <TabsTrigger value="all">Toutes</TabsTrigger>
            <TabsTrigger value="done">Terminées</TabsTrigger>
          </TabsList>
        </Tabs>
        {isDirigeant && (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={team} onCheckedChange={(v) => setTeam(v === true)} /> Toute l'équipe
          </label>
        )}
      </div>

      {isLoading ? (
        <LoadingBlock />
      ) : !data?.data.length ? (
        <EmptyState>{filter === "done" ? "Aucune tâche terminée." : "Rien à faire pour l'instant."}</EmptyState>
      ) : (
        <div className="space-y-2">
          {data.data.map((task) => (
            <Card key={task.id} className={cn("flex items-start gap-3 p-4", task.is_overdue && "border-red-300")}>
              <Checkbox
                className="mt-1"
                checked={task.done_at !== null}
                onCheckedChange={(v) => toggle.mutate({ id: task.id, done: v === true })}
                aria-label="Marquer comme fait"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={cn("font-medium", task.done_at && "text-muted-foreground line-through")}>{task.title}</p>
                  {task.priority.value === "haute" && <StatusBadge option={task.priority} />}
                </div>
                {task.details && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{task.details}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className={cn(task.is_overdue && "font-medium text-red-600")}>
                    {formatDateTime(task.due_at)} ({fromNow(task.due_at)})
                  </span>
                  {task.client && (
                    <Link to={`/admin/clients/${task.client.id}`} className="text-primary hover:underline">
                      {task.client.name}
                    </Link>
                  )}
                  {task.property && (
                    <Link to={`/admin/biens/${task.property.id}`} className="text-primary hover:underline">
                      {task.property.reference}
                    </Link>
                  )}
                  {team && task.user && <span>Pour {task.user.name}</span>}
                </div>
              </div>
              {task.client?.whatsapp_url && !task.done_at && <WhatsAppLink url={task.client.whatsapp_url} />}
            </Card>
          ))}
        </div>
      )}

      <TaskDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}

function TaskDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useAuth();
  const priorities = useOptions("task_priorities");
  const empty = { title: "", details: "", due_at: "", priority: "normale", user_id: "" };
  const [form, setForm] = useState(empty);

  const { data: users } = useQuery({
    queryKey: ["users", "assignable"],
    queryFn: () => api<Paginated<User>>("/users", { query: { active: true } }),
    enabled: open && !!user?.roles.some((r) => r.value === "dirigeant"),
  });

  const mutation = useApiMutation(
    (body: typeof form) =>
      api("/tasks", { method: "POST", body: { ...body, user_id: body.user_id ? Number(body.user_id) : undefined } }),
    {
      success: "Tâche créée.",
      invalidate: [["tasks"]],
      onSuccess: () => {
        setForm(empty);
        onOpenChange(false);
      },
    },
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle tâche</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Quoi ?" htmlFor="title" error={mutation.error?.field("title")}>
            <Input id="title" placeholder="Rappeler M. Diop" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pour quand ?" htmlFor="due_at" error={mutation.error?.field("due_at")}>
              <Input id="due_at" type="datetime-local" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} required />
            </Field>
            <Field label="Priorité" htmlFor="priority">
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger id="priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {priorities.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          {users && (
            <Field label="Pour qui ?" htmlFor="user_id">
              <Select value={form.user_id || String(user?.id)} onValueChange={(v) => setForm({ ...form, user_id: v })}>
                <SelectTrigger id="user_id"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {users.data.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Détails" htmlFor="details">
            <Textarea id="details" rows={3} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
          </Field>
          <DialogFooter>
            <Button type="submit" variant="gold" disabled={mutation.isPending}>Créer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
