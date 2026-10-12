import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Crown, Eye, Pencil, Plus, Search, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { fromNow } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth } from "../auth";
import { useApiMutation } from "../hooks";
import { useGrantLock, useRolesData } from "../rbac";
import type { Paginated, PermissionModule, Role, User } from "../types";
import { PermissionPicker } from "../components/PermissionPicker";
import { Avatar, EmptyState, Field, FormError, LoadingBlock, PageHeader, Pagination } from "../components/ui";

export default function UsersPage() {
  const { can } = useAuth();
  const canManage = can("users.manage");
  const { roles, modules } = useRolesData();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<User | "new" | null>(null);

  const query = { search, page, role: role === "all" ? undefined : role };
  const { data, isLoading } = useQuery({
    queryKey: ["users", query],
    queryFn: () => api<Paginated<User>>("/users", { query }),
  });

  return (
    <>
      <PageHeader
        title="Comptes"
        description="Qui a accès au back-office, avec quels rôles et quels droits. Un compte n'est jamais supprimé : il est désactivé."
        actions={
          <>
            <Button asChild variant="outline"><Link to="/admin/roles"><ShieldCheck className="h-4 w-4" /> Rôles et droits</Link></Button>
            {canManage && <Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Nouveau compte</Button>}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="bg-card pl-9" placeholder="Nom, email ou téléphone" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={role} onValueChange={(v) => { setRole(v); setPage(1); }}>
          <SelectTrigger className="w-52 bg-card" aria-label="Filtrer par rôle"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les rôles</SelectItem>
            {roles?.map((r) => <SelectItem key={r.id} value={r.name}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? <LoadingBlock /> : !data?.data.length ? <EmptyState>Aucun compte.</EmptyState> : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Nom</TableHead>
                <TableHead className="hidden md:table-cell">Contact</TableHead>
                <TableHead>Rôles et droits</TableHead>
                <TableHead className="hidden md:table-cell">Dernière connexion</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((u) => (
                <TableRow key={u.id} className={cn("cursor-pointer", !u.is_active && "opacity-50")} onClick={() => setEditing(u)}>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-3"><Avatar name={u.name} size="sm" />{u.name}</span>
                    {!u.is_active && <Badge variant="outline" className="ml-2">Désactivé</Badge>}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    <div>{u.email}</div><div>{u.phone}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      {u.roles.map((r) => (
                        <Badge key={r.value} variant="secondary" className={cn(r.is_super_admin && "bg-amber-100 text-amber-800")}>
                          {r.is_super_admin && <Crown className="mr-1 h-3 w-3" />}{r.label}
                        </Badge>
                      ))}
                      {u.direct_permissions.length > 0 && <Badge variant="outline">+{u.direct_permissions.length} droit{u.direct_permissions.length > 1 ? "s" : ""}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{fromNow(u.last_login_at)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" aria-label={`${canManage ? "Modifier" : "Voir"} ${u.name}`}>
                      {canManage ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onChange={setPage} />}

      {editing && roles && modules && (
        <UserSheet user={editing === "new" ? null : editing} roles={roles} modules={modules} readOnly={!canManage} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function UserSheet({ user, roles, modules, readOnly, onClose }: { user: User | null; roles: Role[]; modules: PermissionModule[]; readOnly: boolean; onClose: () => void }) {
  const { user: me, isSuperAdmin } = useAuth();
  const lock = useGrantLock();
  const isSelf = user?.id === me?.id;
  // Ses propres droits ne se modifient pas (sauf le dirigeant, qui ne peut pas retirer le sien).
  const accessReadOnly = readOnly || (isSelf && !isSuperAdmin) || (!!user?.is_super_admin && !isSuperAdmin);
  const [form, setForm] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    roles: user?.roles.map((r) => r.value) ?? [],
    permissions: user?.direct_permissions ?? [],
    is_active: user?.is_active ?? true,
    password: "",
  });

  // Droits apportés par les rôles cochés : affichés « donnés par » dans les droits individuels.
  const inherited = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const role of roles.filter((r) => form.roles.includes(r.name))) {
      const names = role.is_super_admin ? modules.flatMap((m) => m.permissions.map((p) => p.name)) : role.permissions;
      for (const name of names) (map[name] ??= []).push(role.label);
    }
    return map;
  }, [roles, modules, form.roles]);
  const total = modules.reduce((n, m) => n + m.permissions.length, 0);
  const effective = new Set([...Object.keys(inherited), ...form.permissions]).size;

  const mutation = useApiMutation(
    (body: typeof form) => {
      const payload: Record<string, unknown> = { ...body, phone: body.phone || null, permissions: body.permissions.filter((p) => !inherited[p]) };
      if (!body.password) delete payload.password;
      if (accessReadOnly) { delete payload.roles; delete payload.permissions; }
      return user ? api(`/users/${user.id}`, { method: "PUT", body: payload }) : api("/users", { method: "POST", body: payload });
    },
    { success: user ? "Compte mis à jour." : "Compte créé.", invalidate: [["users"], ["roles"], ["me"]], onSuccess: onClose },
  );

  const roleLock = (role: Role): string | null => {
    if (role.is_super_admin && !isSuperAdmin) return "Seul un dirigeant attribue ce rôle.";
    if (isSelf && role.is_super_admin && form.roles.includes(role.name)) return "Vous ne pouvez pas retirer votre propre rôle de dirigeant.";
    const missing = role.permissions.filter((p) => lock(p));
    if (!form.roles.includes(role.name) && missing.length) return `Contient ${missing.length} droit${missing.length > 1 ? "s" : ""} que vous n'avez pas.`;
    return null;
  };

  const submit = (e: FormEvent) => { e.preventDefault(); mutation.mutate(form); };
  const error = mutation.error;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{user ? (readOnly ? user.name : `Modifier ${user.name}`) : "Nouveau compte"}</SheetTitle>
          <SheetDescription>{effective === total ? "Tous les droits." : `${effective} droit${effective > 1 ? "s" : ""} sur ${total}.`} La personne se connecte avec son email ou son téléphone.</SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="mt-4 space-y-5">
          <FormError message={error?.field("user")} />
          <Tabs defaultValue="compte">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="compte">Compte</TabsTrigger>
              <TabsTrigger value="roles">Rôles</TabsTrigger>
              <TabsTrigger value="droits">Droits individuels</TabsTrigger>
            </TabsList>

            <TabsContent value="compte" className="mt-4 space-y-4">
              <Field label="Nom complet" htmlFor="name" error={error?.field("name")}>
                <Input id="name" value={form.name} disabled={readOnly} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Email" htmlFor="email" error={error?.field("email")}>
                  <Input id="email" type="email" value={form.email} disabled={readOnly} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </Field>
                <Field label="Téléphone" htmlFor="phone" error={error?.field("phone")}>
                  <Input id="phone" placeholder="77 123 45 67" value={form.phone} disabled={readOnly} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </Field>
              </div>
              {!readOnly && (
                <Field label={user ? "Nouveau mot de passe (laisser vide pour ne pas changer)" : "Mot de passe"} htmlFor="password"
                  error={error?.field("password")} hint="10 caractères minimum, avec des lettres et des chiffres.">
                  <Input id="password" type="password" autoComplete="new-password" value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })} required={!user} />
                </Field>
              )}
              {user && !isSelf && !readOnly && (
                <label className="flex items-center justify-between rounded-md border p-3 text-sm">
                  <span>
                    Compte actif
                    <span className="block text-xs text-muted-foreground">Désactiver coupe l'accès immédiatement, sur tous les appareils.</span>
                  </span>
                  <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                </label>
              )}
              <FormError message={error?.field("is_active")} />
            </TabsContent>

            <TabsContent value="roles" className="mt-4 space-y-2">
              {accessReadOnly && !readOnly && <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">{isSelf ? "Vous ne pouvez pas modifier vos propres droits." : "Seul un dirigeant modifie les droits d'un dirigeant."}</p>}
              <FormError message={error?.field("roles") ?? error?.field("roles.0")} />
              {roles.map((role) => {
                const checked = form.roles.includes(role.name);
                const reason = accessReadOnly ? null : roleLock(role);
                return (
                  <label key={role.id} className={cn("flex items-start gap-3 rounded-lg border p-3 transition", checked ? "border-primary bg-primary/5" : "bg-card", !accessReadOnly && !reason && "cursor-pointer hover:border-primary/40")}>
                    <Checkbox className="mt-0.5" checked={checked} disabled={accessReadOnly || !!reason}
                      onCheckedChange={(v) => setForm({ ...form, roles: v === true ? [...form.roles, role.name] : form.roles.filter((r) => r !== role.name) })} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm font-medium">{role.is_super_admin && <Crown className="h-3.5 w-3.5 text-amber-500" />}{role.label}</span>
                      {role.description && <span className="block text-xs text-muted-foreground">{role.description}</span>}
                      <span className="mt-0.5 block text-xs text-muted-foreground">{role.is_super_admin ? "Tous les droits" : `${role.permissions.length} droits`}</span>
                      {reason && <span className="mt-0.5 block text-xs text-amber-700">{reason}</span>}
                    </span>
                  </label>
                );
              })}
            </TabsContent>

            <TabsContent value="droits" className="mt-4 space-y-3">
              <p className="text-xs text-muted-foreground">Droits donnés à cette personne en plus de ses rôles. Ceux déjà apportés par un rôle sont cochés d'office.</p>
              <FormError message={error?.field("permissions")} />
              <PermissionPicker modules={modules} value={form.permissions} inherited={inherited} readOnly={accessReadOnly} locked={lock}
                onChange={(permissions) => setForm({ ...form, permissions })} />
            </TabsContent>
          </Tabs>

          {!readOnly && (
            <div className="sticky bottom-0 -mx-6 flex justify-end gap-2 border-t bg-background px-6 py-3">
              <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
              <Button type="submit" disabled={mutation.isPending}>Enregistrer</Button>
            </div>
          )}
        </form>
      </SheetContent>
    </Sheet>
  );
}
