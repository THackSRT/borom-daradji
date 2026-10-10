import { createContext, useContext, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useAuth } from "../auth";
import { useApiMutation, useOptions } from "../hooks";
import type { Client, Paginated, Property, User } from "../types";
import { ClientForm } from "./ClientForm";
import { PropertyForm, type PropertyPayload } from "./PropertyForm";
import { Field, FormError } from "./ui";

type Kind = "property" | "client" | "task";

interface TaskDefaults {
  client?: { id: number; name: string };
  property?: { id: number; reference: string };
  title?: string;
}

interface QuickCreateValue {
  open: (kind: Kind, defaults?: TaskDefaults) => void;
}

const QuickCreateContext = createContext<QuickCreateValue | null>(null);

/** Création d'un bien, d'un client ou d'une tâche depuis n'importe quel écran. */
export function QuickCreateProvider({ children }: { children: ReactNode }) {
  const [kind, setKind] = useState<Kind | null>(null);
  const [defaults, setDefaults] = useState<TaskDefaults>({});
  const close = () => setKind(null);

  return (
    <QuickCreateContext.Provider value={{ open: (k, d = {}) => { setDefaults(d); setKind(k); } }}>
      {children}
      {kind === "property" && <PropertyCreateDialog onClose={close} />}
      {kind === "client" && <ClientCreateDialog onClose={close} />}
      {kind === "task" && <TaskCreateDialog defaults={defaults} onClose={close} />}
    </QuickCreateContext.Provider>
  );
}

export function useQuickCreate(): QuickCreateValue {
  const value = useContext(QuickCreateContext);
  if (!value) throw new Error("useQuickCreate doit être utilisé dans QuickCreateProvider");
  return value;
}

function PropertyCreateDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const create = useApiMutation((body: PropertyPayload) => api<{ data: Property }>("/properties", { method: "POST", body }), {
    success: "Bien créé. Prochaine étape : la vérification foncière.",
    invalidate: [["properties"], ["dashboard"]],
    onSuccess: (r) => { onClose(); navigate(`/admin/biens/${r.data.id}`); },
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau bien</DialogTitle>
          <DialogDescription>Le bien est créé en brouillon : il ne sera visible sur le site qu'après la vérification foncière.</DialogDescription>
        </DialogHeader>
        <PropertyForm error={create.error} pending={create.isPending} onSubmit={(p) => create.mutate(p)} onCancel={onClose} />
      </DialogContent>
    </Dialog>
  );
}

function ClientCreateDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const create = useApiMutation((body: Record<string, unknown>) => api<{ data: Client }>("/clients", { method: "POST", body }), {
    success: "Client créé.",
    invalidate: [["clients"], ["dashboard"]],
    onSuccess: (r) => { onClose(); navigate(`/admin/clients/${r.data.id}`); },
  });

  // 409 : ce numéro existe déjà, on propose la fiche existante plutôt qu'un doublon.
  const duplicate = create.error?.status === 409 ? (create.error.data as { message: string; client: Client & { data?: Client } }) : null;
  const existing = duplicate ? (duplicate.client.data ?? duplicate.client) : null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouveau client</DialogTitle>
          <DialogDescription>Le numéro de téléphone identifie le client : pas de doublon possible.</DialogDescription>
        </DialogHeader>
        {duplicate && existing && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <span>{duplicate.message}</span>
            <Button asChild size="sm" onClick={onClose}><Link to={`/admin/clients/${existing.id}`}>Ouvrir sa fiche</Link></Button>
          </div>
        )}
        <ClientForm error={create.error} pending={create.isPending} onSubmit={(p) => create.mutate(p)} onCancel={onClose} />
      </DialogContent>
    </Dialog>
  );
}

function TaskCreateDialog({ defaults, onClose }: { defaults: TaskDefaults; onClose: () => void }) {
  const { user, can } = useAuth();
  const assignToOthers = can("users.view", "users.manage");
  const priorities = useOptions("task_priorities");
  const tomorrow9 = new Date(Date.now() + 86_400_000);
  tomorrow9.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  const [form, setForm] = useState({
    title: defaults.title ?? "",
    details: "",
    due_at: `${tomorrow9.getFullYear()}-${pad(tomorrow9.getMonth() + 1)}-${pad(tomorrow9.getDate())}T09:00`,
    priority: "normale",
    user_id: String(user?.id ?? ""),
  });

  const { data: users } = useQuery({
    queryKey: ["users", "assignable"],
    queryFn: () => api<Paginated<User>>("/users", { query: { active: true } }),
    enabled: assignToOthers,
  });

  const mutation = useApiMutation(
    () => api("/tasks", {
      method: "POST",
      body: { ...form, user_id: Number(form.user_id) || undefined, client_id: defaults.client?.id, property_id: defaults.property?.id },
    }),
    { success: "Tâche ajoutée.", invalidate: [["tasks"], ["dashboard"]], onSuccess: onClose },
  );

  const submit = (e: FormEvent) => { e.preventDefault(); mutation.mutate(undefined); };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle tâche</DialogTitle>
          {(defaults.client || defaults.property) && (
            <DialogDescription>Liée à {[defaults.client?.name, defaults.property?.reference].filter(Boolean).join(" · ")}</DialogDescription>
          )}
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="À faire" htmlFor="t-title" error={mutation.error?.field("title")}>
            <Input id="t-title" autoFocus placeholder="Rappeler M. Diop pour la contre-offre" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Échéance" htmlFor="t-due" error={mutation.error?.field("due_at")}>
              <Input id="t-due" type="datetime-local" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} required />
            </Field>
            <Field label="Priorité" htmlFor="t-priority">
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger id="t-priority"><SelectValue /></SelectTrigger>
                <SelectContent>{priorities.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          {users && (
            <Field label="Pour" htmlFor="t-user">
              <Select value={form.user_id} onValueChange={(v) => setForm({ ...form, user_id: v })}>
                <SelectTrigger id="t-user"><SelectValue /></SelectTrigger>
                <SelectContent>{users.data.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Détails" htmlFor="t-details">
            <Textarea id="t-details" rows={3} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} />
          </Field>
          <FormError message={mutation.error && mutation.error.status !== 422 ? mutation.error.message : null} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={mutation.isPending}>Ajouter</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
