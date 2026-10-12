import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Crown, Lock, Plus, ShieldCheck, Trash2, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "../auth";
import { useApiMutation } from "../hooks";
import { useGrantLock, useRolesData } from "../rbac";
import type { PermissionModule, Role } from "../types";
import { PermissionPicker } from "../components/PermissionPicker";
import { Field, FormError, LoadingBlock, PageHeader } from "../components/ui";

const tabClass = "rounded-lg border border-transparent px-3 py-1.5 data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:shadow-sm";

export default function RolesPage() {
  const { can } = useAuth();
  const canManage = can("roles.manage");
  const { roles, modules, isLoading } = useRolesData();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState("roles");

  useEffect(() => {
    if (roles?.length && selectedId === null) setSelectedId(roles[0].id);
  }, [roles, selectedId]);

  if (isLoading || !roles || !modules) return <LoadingBlock rows={6} />;
  const selected = roles.find((r) => r.id === selectedId);
  if (!selected) return <LoadingBlock rows={6} />;

  return (
    <>
      <PageHeader
        title="Rôles et droits"
        description="Un rôle regroupe des droits ; un compte peut cumuler plusieurs rôles et recevoir des droits en plus. Tout est vérifié par le serveur."
        actions={canManage && <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Nouveau rôle</Button>}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
          <TabsTrigger value="roles" className={tabClass}>Rôles</TabsTrigger>
          <TabsTrigger value="matrice" className={tabClass}>Matrice des droits</TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <ul className="space-y-2 lg:sticky lg:top-24 lg:self-start">
              {roles.map((role) => (
                <li key={role.id}>
                  <button type="button" onClick={() => setSelectedId(role.id)}
                    className={cn("w-full rounded-xl border bg-card p-3 text-left shadow-sm transition",
                      role.id === selected.id ? "border-primary ring-1 ring-primary" : "hover:border-primary/30")}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2 font-medium">
                        {role.is_super_admin ? <Crown className="h-4 w-4 shrink-0 text-amber-500" /> : <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        <span className="truncate">{role.label}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"><Users className="h-3.5 w-3.5" />{role.users_count}</span>
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {role.is_super_admin ? "Tous les droits" : `${role.permissions.length} droit${role.permissions.length > 1 ? "s" : ""}`}
                      {role.is_system ? " · fourni par défaut" : " · personnalisé"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <RoleEditor key={selected.id} role={selected} modules={modules} canManage={canManage} onDeleted={() => setSelectedId(null)} onDuplicated={setSelectedId} />
          </div>
        </TabsContent>

        <TabsContent value="matrice" className="mt-4">
          <Matrix roles={roles} modules={modules} onPick={(id) => { setSelectedId(id); setTab("roles"); }} />
        </TabsContent>
      </Tabs>

      <CreateRoleDialog open={creating} onOpenChange={setCreating} roles={roles} onCreated={(id) => { setSelectedId(id); setTab("roles"); }} />
    </>
  );
}

function RoleEditor({ role, modules, canManage, onDeleted, onDuplicated }: {
  role: Role; modules: PermissionModule[]; canManage: boolean; onDeleted: () => void; onDuplicated: (id: number) => void;
}) {
  const queryClient = useQueryClient();
  const lock = useGrantLock();
  const [label, setLabel] = useState(role.label);
  const [description, setDescription] = useState(role.description ?? "");
  const [permissions, setPermissions] = useState(role.permissions);
  const readOnly = !canManage || role.is_super_admin;

  const added = permissions.filter((p) => !role.permissions.includes(p)).length;
  const removed = role.permissions.filter((p) => !permissions.includes(p)).length;
  const dirty = added + removed > 0 || label !== role.label || description !== (role.description ?? "");
  const refresh = () => { queryClient.invalidateQueries({ queryKey: ["roles"] }); queryClient.invalidateQueries({ queryKey: ["permissions"] }); queryClient.invalidateQueries({ queryKey: ["me"] }); };

  const save = useApiMutation(() => api(`/roles/${role.id}`, { method: "PUT", body: { label, description: description || null, permissions } }), {
    success: "Rôle enregistré : les comptes concernés ont leurs nouveaux droits.", onSuccess: refresh,
  });
  const duplicate = useApiMutation(() => api<{ data: Role }>(`/roles/${role.id}/duplicate`, { method: "POST" }), {
    success: "Rôle dupliqué.",
    onSuccess: (r) => {
      // Ajouté tout de suite à la liste : l'écran passe sur la copie sans attendre le rechargement.
      queryClient.setQueryData<Role[]>(["roles"], (list) => [...(list ?? []), r.data]);
      onDuplicated(r.data.id);
      refresh();
    },
  });
  const remove = useApiMutation(() => api(`/roles/${role.id}`, { method: "DELETE" }), {
    success: "Rôle supprimé.", onSuccess: () => { onDeleted(); refresh(); },
  });
  const error = save.error ?? duplicate.error ?? remove.error;

  return (
    <div className="min-w-0 space-y-4">
      <section className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{role.label}</h2>
              {role.is_super_admin && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100"><Crown className="mr-1 h-3 w-3" /> Accès complet</Badge>}
              {role.is_system ? <Badge variant="outline">Fourni par défaut</Badge> : <Badge variant="secondary">Personnalisé</Badge>}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Nom technique : <code>{role.name}</code> · {role.users_count} compte{role.users_count > 1 ? "s" : ""}</p>
          </div>
          {canManage && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => duplicate.mutate(undefined)} disabled={duplicate.isPending}><Copy className="h-4 w-4" /> Dupliquer</Button>
              {!role.is_system && (
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" disabled={remove.isPending}
                  onClick={() => window.confirm(`Supprimer le rôle « ${role.label} » ?`) && remove.mutate(undefined)}>
                  <Trash2 className="h-4 w-4" /> Supprimer
                </Button>
              )}
            </div>
          )}
        </div>
        <div className="mt-4"><FormError message={error?.field("role")} /></div>
        {role.is_super_admin ? (
          <p className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" /> Le dirigeant a tous les droits, y compris ceux des fonctions ajoutées plus tard. Ce rôle ne se modifie pas et ne peut être attribué que par un dirigeant.
          </p>
        ) : (
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <Field label="Nom du rôle" htmlFor="role-label" error={save.error?.field("label")}>
              <Input id="role-label" value={label} disabled={readOnly} onChange={(e) => setLabel(e.target.value)} />
            </Field>
            <Field label="Description" htmlFor="role-description" error={save.error?.field("description")}>
              <Textarea id="role-description" rows={1} value={description} disabled={readOnly} onChange={(e) => setDescription(e.target.value)} />
            </Field>
          </div>
        )}
      </section>

      <FormError message={save.error?.field("permissions")} />
      <PermissionPicker modules={modules} value={role.is_super_admin ? modules.flatMap((m) => m.permissions.map((p) => p.name)) : permissions}
        onChange={setPermissions} readOnly={readOnly} locked={lock} />

      {dirty && !readOnly && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t bg-card/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur lg:bottom-0 lg:left-64">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 lg:px-4">
            <p className="text-sm text-muted-foreground">
              {added > 0 && <span className="text-emerald-700">+{added} droit{added > 1 ? "s" : ""} </span>}
              {removed > 0 && <span className="text-red-600">−{removed} droit{removed > 1 ? "s" : ""} </span>}
              · s'applique à {role.users_count} compte{role.users_count > 1 ? "s" : ""}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => { setLabel(role.label); setDescription(role.description ?? ""); setPermissions(role.permissions); }}><X className="h-4 w-4" /> Annuler</Button>
              <Button onClick={() => save.mutate(undefined)} disabled={save.isPending}><Check className="h-4 w-4" /> Enregistrer</Button>
            </div>
          </div>
        </div>
      )}
      {dirty && !readOnly && <div className="h-16" aria-hidden />}
    </div>
  );
}

/** Tableau croisé : droits en lignes, rôles en colonnes. */
function Matrix({ roles, modules, onPick }: { roles: Role[]; modules: PermissionModule[]; onPick: (id: number) => void }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="sticky left-0 z-10 bg-muted/40 px-4 py-3 text-left font-medium text-muted-foreground">Droit</th>
            {roles.map((r) => (
              <th key={r.id} className="px-2 py-3 text-center font-medium">
                <button type="button" className="hover:text-primary hover:underline" onClick={() => onPick(r.id)}>{r.label}</button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {modules.map((m) => (
            <MatrixModule key={m.key} module={m} roles={roles} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatrixModule({ module, roles }: { module: PermissionModule; roles: Role[] }) {
  return (
    <>
      <tr className="border-b bg-muted/20">
        <td colSpan={roles.length + 1} className="sticky left-0 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{module.label}</td>
      </tr>
      {module.permissions.map((p) => (
        <tr key={p.name} className="border-b last:border-0 hover:bg-muted/20">
          <td className="sticky left-0 z-10 bg-card px-4 py-2" title={p.description ?? undefined}>{p.label}</td>
          {roles.map((r) => {
            const on = r.is_super_admin || p.roles.includes(r.name);
            return (
              <td key={r.id} className="px-2 py-2 text-center">
                {on ? <Check className={cn("mx-auto h-4 w-4", r.is_super_admin ? "text-amber-500" : "text-emerald-600")} aria-label="Oui" /> : <span className="text-muted-foreground/40" aria-label="Non">—</span>}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

function CreateRoleDialog({ open, onOpenChange, roles, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; roles: Role[]; onCreated: (id: number) => void }) {
  const queryClient = useQueryClient();
  const lock = useGrantLock();
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [base, setBase] = useState("none");
  const mutation = useApiMutation(
    () => {
      const source = roles.find((r) => String(r.id) === base);
      // On ne reprend que les droits qu'on peut donner soi-même.
      const permissions = (source?.permissions ?? []).filter((p) => !lock(p));
      return api<{ data: Role }>("/roles", { method: "POST", body: { label, description: description || null, permissions } });
    },
    {
      success: "Rôle créé : cochez maintenant ses droits.",
      onSuccess: (r) => {
        queryClient.setQueryData<Role[]>(["roles"], (list) => [...(list ?? []), r.data]);
        setLabel(""); setDescription(""); setBase("none");
        onOpenChange(false);
        onCreated(r.data.id);
        queryClient.invalidateQueries({ queryKey: ["roles"] });
        queryClient.invalidateQueries({ queryKey: ["permissions"] });
      },
    },
  );
  const submit = (e: FormEvent) => { e.preventDefault(); mutation.mutate(undefined); };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Nouveau rôle</DialogTitle>
            <DialogDescription>Ex. « Assistante d'agence », « Chef d'agence Saly », « Stagiaire ».</DialogDescription>
          </DialogHeader>
          <Field label="Nom du rôle" htmlFor="new-role-label" error={mutation.error?.field("label")}>
            <Input id="new-role-label" value={label} onChange={(e) => setLabel(e.target.value)} autoFocus required />
          </Field>
          <Field label="Description (facultatif)" htmlFor="new-role-description">
            <Textarea id="new-role-description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Partir de" hint="Les droits du rôle choisi sont repris ; vous les ajusterez ensuite.">
            <Select value={base} onValueChange={setBase}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucun droit</SelectItem>
                {roles.filter((r) => !r.is_super_admin).map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <FormError message={mutation.error?.field("permissions")} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={mutation.isPending || !label.trim()}>Créer le rôle</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
