import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { fromNow } from "@/lib/format";
import { useAuth } from "../auth";
import { useApiMutation, useOptions } from "../hooks";
import type { Paginated, User } from "../types";
import { Avatar, EmptyState, Field, FormError, LoadingBlock, PageHeader, Pagination } from "../components/ui";

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<User | "new" | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["users", { search, page }],
    queryFn: () => api<Paginated<User>>("/users", { query: { search, page } }),
  });

  return (
    <>
      <PageHeader
        title="Comptes"
        description="Qui a accès au back-office, avec quels rôles. Un compte n'est jamais supprimé : il est désactivé."
        actions={<Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Nouveau compte</Button>}
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="bg-card pl-9" placeholder="Nom, email ou téléphone" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {isLoading ? <LoadingBlock /> : !data?.data.length ? <EmptyState>Aucun compte.</EmptyState> : (
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Nom</TableHead>
                <TableHead className="hidden md:table-cell">Contact</TableHead>
                <TableHead>Rôles</TableHead>
                <TableHead className="hidden md:table-cell">Dernière connexion</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((u) => (
                <TableRow key={u.id} className={u.is_active ? "" : "opacity-50"}>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-3"><Avatar name={u.name} size="sm" />{u.name}</span>
                    {!u.is_active && <Badge variant="outline" className="ml-2">Désactivé</Badge>}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    <div>{u.email}</div><div>{u.phone}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">{u.roles.map((r) => <Badge key={r.value} variant="secondary">{r.label}</Badge>)}</div>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{fromNow(u.last_login_at)}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => setEditing(u)} aria-label={`Modifier ${u.name}`}><Pencil className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onChange={setPage} />}

      {editing && <UserDialog user={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function UserDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { user: me } = useAuth();
  const roles = useOptions("roles");
  const isSelf = user?.id === me?.id;
  const [form, setForm] = useState({
    name: user?.name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    roles: user?.roles.map((r) => r.value as string) ?? [],
    is_active: user?.is_active ?? true,
    password: "",
  });

  const mutation = useApiMutation(
    (body: typeof form) => {
      const payload: Record<string, unknown> = { ...body, phone: body.phone || null };
      if (!body.password) delete payload.password;
      return user ? api(`/users/${user.id}`, { method: "PUT", body: payload }) : api("/users", { method: "POST", body: payload });
    },
    { success: user ? "Compte mis à jour." : "Compte créé.", invalidate: [["users"]], onSuccess: onClose },
  );

  const toggleRole = (value: string, checked: boolean) =>
    setForm({ ...form, roles: checked ? [...form.roles, value] : form.roles.filter((r) => r !== value) });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  const error = mutation.error;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{user ? `Modifier ${user.name}` : "Nouveau compte"}</DialogTitle>
          <DialogDescription>La personne pourra se connecter avec son email ou son téléphone.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nom complet" htmlFor="name" error={error?.field("name")}>
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" htmlFor="email" error={error?.field("email")}>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </Field>
            <Field label="Téléphone" htmlFor="phone" error={error?.field("phone")}>
              <Input id="phone" placeholder="77 123 45 67" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
          </div>
          <Field label="Rôles (cumulables)" error={error?.field("roles") ?? error?.field("roles.0")}>
            <div className="grid gap-2 sm:grid-cols-2">
              {roles.map((r) => (
                <label key={r.value} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.roles.includes(r.value)} disabled={isSelf && r.value === "dirigeant"}
                    onCheckedChange={(v) => toggleRole(r.value, v === true)} />
                  {r.label}
                </label>
              ))}
            </div>
          </Field>
          <Field label={user ? "Nouveau mot de passe (laisser vide pour ne pas changer)" : "Mot de passe"} htmlFor="password"
            error={error?.field("password")} hint="10 caractères minimum, avec des lettres et des chiffres.">
            <Input id="password" type="password" autoComplete="new-password" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} required={!user} />
          </Field>
          {user && !isSelf && (
            <label className="flex items-center justify-between rounded-md border p-3 text-sm">
              <span>
                Compte actif
                <span className="block text-xs text-muted-foreground">Désactiver coupe l'accès immédiatement, sur tous les appareils.</span>
              </span>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </label>
          )}
          <FormError message={error?.field("is_active")} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={mutation.isPending}>Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
