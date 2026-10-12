import { Link } from "react-router-dom";
import { CalendarClock, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApiMutation } from "../hooks";
import type { Task } from "../types";
import { StatusBadge, WhatsAppLink } from "./ui";

function dueLabel(iso: string): string {
  const due = new Date(iso);
  const time = due.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const today = new Date();
  const days = Math.round((new Date(due.toDateString()).getTime() - new Date(today.toDateString()).getTime()) / 86_400_000);
  if (days === 0) return `Aujourd'hui, ${time}`;
  if (days === 1) return `Demain, ${time}`;
  if (days === -1) return `Hier, ${time}`;
  return formatDate(iso, "EEE d MMM, HH'h'mm");
}

/** Une tâche : cocher pour terminer, reporter à demain, écrire au client. */
export function TaskItem({ task, showOwner = false }: { task: Task; showOwner?: boolean }) {
  const invalidate = [["tasks"], ["dashboard"]];
  const toggle = useApiMutation(() => api(`/tasks/${task.id}`, { method: "PUT", body: { done: task.done_at === null } }), {
    success: task.done_at === null ? "Tâche terminée." : undefined,
    invalidate,
  });
  const snooze = useApiMutation(() => {
    const next = new Date(Date.now() + 86_400_000);
    next.setHours(9, 0, 0, 0);
    return api(`/tasks/${task.id}`, { method: "PUT", body: { due_at: next.toISOString() } });
  }, { success: "Reportée à demain 9 h.", invalidate });

  const done = task.done_at !== null;

  return (
    <div className={cn("group flex items-start gap-3 rounded-lg px-3 py-3 transition hover:bg-muted/50", toggle.isPending && "opacity-50")}>
      <button
        type="button"
        onClick={() => toggle.mutate(undefined)}
        aria-label={done ? "Rouvrir la tâche" : "Marquer comme faite"}
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition",
          done ? "border-emerald-500 bg-emerald-500 text-white" : "border-muted-foreground/40 hover:border-emerald-500 hover:bg-emerald-50",
        )}
      >
        {done && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn("text-sm font-medium", done && "text-muted-foreground line-through")}>{task.title}</p>
          {task.priority.value === "haute" && !done && <StatusBadge option={task.priority} />}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className={cn("inline-flex items-center gap-1", task.is_overdue && "font-medium text-red-600")}>
            <CalendarClock className="h-3.5 w-3.5" />{dueLabel(task.due_at)}
          </span>
          {task.client && <Link to={`/admin/clients/${task.client.id}`} className="font-medium text-foreground/80 hover:text-primary hover:underline">{task.client.name}</Link>}
          {task.property && <Link to={`/admin/biens/${task.property.id}`} className="font-mono hover:text-primary hover:underline">{task.property.reference}</Link>}
          {showOwner && task.user && <span>· {task.user.name}</span>}
        </div>
        {task.details && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.details}</p>}
      </div>
      {!done && (
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" className="hidden h-8 text-xs text-muted-foreground group-hover:inline-flex" onClick={() => snooze.mutate(undefined)}>
            Demain
          </Button>
          <WhatsAppLink url={task.client?.whatsapp_url} size="icon" />
        </div>
      )}
    </div>
  );
}
