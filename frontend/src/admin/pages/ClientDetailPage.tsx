import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Archive, ArrowLeft, CalendarPlus, Download, Home, Mail, Phone, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, downloadFile } from "@/lib/api";
import { formatDate, formatDateTime, formatPrice, fromNow } from "@/lib/format";
import { useAuth } from "../auth";
import { useApiMutation, useOptions } from "../hooks";
import type { Client, DocumentItem, Property, SearchCriterion, Visit } from "../types";
import { ClientForm } from "../components/ClientForm";
import { PlanVisitDialog, VisitReportDialog } from "../components/VisitDialogs";
import { EmptyState, Field, FormError, LoadingBlock, StatusBadge, WhatsAppLink } from "../components/ui";

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const pipeline = useOptions("pipeline_statuses");
  const key = ["client", id];
  const { data: client, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api<{ data: Client }>(`/clients/${id}`).then((r) => r.data),
  });
  const [planning, setPlanning] = useState(false);
  const [reporting, setReporting] = useState<Visit | null>(null);

  const setStage = useApiMutation((pipeline_status: string) => api(`/clients/${id}`, { method: "PUT", body: { pipeline_status } }), {
    success: "Étape mise à jour.",
    invalidate: [key, ["clients"]],
  });
  const archive = useApiMutation(() => api(`/clients/${id}`, { method: "DELETE" }), {
    success: "Client archivé.",
    invalidate: [["clients"]],
    onSuccess: () => navigate("/admin/clients"),
  });

  if (isLoading || !client) return <LoadingBlock />;
  const prospection = hasRole("agent", "commercial");

  return (
    <>
      <Link to="/admin/clients" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Clients
      </Link>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">{client.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {client.phone && <a href={`tel:${client.phone}`} className="flex items-center gap-1 hover:text-foreground"><Phone className="h-4 w-4" />{client.phone}</a>}
            {client.email && <a href={`mailto:${client.email}`} className="flex items-center gap-1 hover:text-foreground"><Mail className="h-4 w-4" />{client.email}</a>}
            <span>Dernier contact {fromNow(client.last_contact_at)}</span>
            {client.assigned_user && <span>Suivi par {client.assigned_user.name}</span>}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {client.categories.map((c) => <Badge key={c.value} variant="secondary">{c.label}</Badge>)}
            {client.tags.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={client.pipeline_status.value} onValueChange={(v) => setStage.mutate(v)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{pipeline.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
          <WhatsAppLink url={client.whatsapp_url} />
          {prospection && <Button variant="gold" onClick={() => setPlanning(true)}><CalendarPlus className="h-4 w-4" /> Visite</Button>}
          {client.can.delete && (
            <Button variant="outline" onClick={() => confirm(`Archiver ${client.name} ?`) && archive.mutate(undefined)}><Archive className="h-4 w-4" /></Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="echanges">
        <TabsList className="mb-4 flex h-auto flex-wrap justify-start">
          <TabsTrigger value="echanges">Échanges</TabsTrigger>
          <TabsTrigger value="recherche">Recherche</TabsTrigger>
          <TabsTrigger value="visites">Visites ({client.visits?.length ?? 0})</TabsTrigger>
          {client.can.view_documents && <TabsTrigger value="pieces">Pièces</TabsTrigger>}
          <TabsTrigger value="infos">Informations</TabsTrigger>
        </TabsList>

        <TabsContent value="echanges"><InteractionsTab client={client} /></TabsContent>
        <TabsContent value="recherche"><SearchTab client={client} editable={prospection} /></TabsContent>
        <TabsContent value="visites">
          {!client.visits?.length ? <EmptyState>Aucune visite.</EmptyState> : (
            <Card className="divide-y">
              {client.visits.map((v) => (
                <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                  <div>
                    <p className="font-medium">{formatDateTime(v.scheduled_at)} · {v.property && <Link to={`/admin/biens/${v.property.id}`} className="text-primary hover:underline">{v.property.reference}</Link>}</p>
                    <p className="text-muted-foreground">{v.property?.title}{v.notes && ` — ${v.notes}`}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge option={v.status} />
                    {v.feedback && <StatusBadge option={v.feedback} />}
                    {prospection && <Button size="sm" variant="outline" onClick={() => setReporting({ ...v, client: { id: client.id, name: client.name, phone: client.phone, whatsapp_url: client.whatsapp_url } })}>Compte-rendu</Button>}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </TabsContent>
        {client.can.view_documents && <TabsContent value="pieces"><DocumentsTab client={client} /></TabsContent>}
        <TabsContent value="infos"><Card><CardContent className="pt-6"><EditClient client={client} /></CardContent></Card></TabsContent>
      </Tabs>

      <PlanVisitDialog open={planning} onOpenChange={setPlanning} client={client} />
      {reporting && <VisitReportDialog visit={reporting} onClose={() => setReporting(null)} />}
    </>
  );
}

function InteractionsTab({ client }: { client: Client }) {
  const channels = useOptions("interaction_channels").filter((c) => c.value !== "formulaire_site");
  const [form, setForm] = useState({ channel: "appel", summary: "" });
  const add = useApiMutation(() => api(`/clients/${client.id}/interactions`, { method: "POST", body: form }), {
    success: "Échange enregistré.",
    invalidate: [["client", String(client.id)], ["clients"]],
    onSuccess: () => setForm({ ...form, summary: "" }),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:order-2">
        <CardHeader><CardTitle className="text-lg">Noter un échange</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={(e: FormEvent) => { e.preventDefault(); add.mutate(undefined); }} className="space-y-3">
            <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{channels.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
            <Textarea rows={4} placeholder="Ce qui a été dit, ce qui a été convenu" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} required />
            {add.error?.field("summary") && <p className="text-xs text-destructive">{add.error.field("summary")}</p>}
            <Button type="submit" variant="gold" disabled={add.isPending}>Enregistrer</Button>
          </form>
        </CardContent>
      </Card>
      <div className="space-y-3 lg:col-span-2">
        {!client.interactions?.length ? <EmptyState>Aucun échange pour l'instant.</EmptyState> : client.interactions.map((i) => (
          <Card key={i.id} className="p-4 text-sm">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span><Badge variant="secondary" className="mr-2">{i.channel.label}</Badge>{i.user?.name ?? "Site internet"}{i.property && ` · ${i.property.reference}`}</span>
              <span>{formatDateTime(i.occurred_at)}</span>
            </div>
            <p className="whitespace-pre-line">{i.summary}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SearchTab({ client, editable }: { client: Client; editable: boolean }) {
  const transactions = useOptions("transaction_types");
  const types = useOptions("property_types");
  const empty = { transaction: "vente", types: [] as string[], budget_min: "", budget_max: "", cities: "", neighborhoods: "", rooms_min: "" };
  const [form, setForm] = useState(empty);
  const invalidate = [["client", String(client.id)], ["matches", client.id]];

  const { data: matches } = useQuery({
    queryKey: ["matches", client.id],
    queryFn: () => api<{ data: Property[] }>(`/clients/${client.id}/matches`).then((r) => r.data),
  });

  const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
  const add = useApiMutation(
    () => api(`/clients/${client.id}/search-criteria`, {
      method: "POST",
      body: {
        transaction: form.transaction,
        types: form.types,
        budget_min: form.budget_min ? Number(form.budget_min) : null,
        budget_max: form.budget_max ? Number(form.budget_max) : null,
        cities: list(form.cities),
        neighborhoods: list(form.neighborhoods),
        rooms_min: form.rooms_min ? Number(form.rooms_min) : null,
      },
    }),
    { success: "Critères enregistrés.", invalidate, onSuccess: () => setForm(empty) },
  );
  const toggle = useApiMutation((c: SearchCriterion) => api(`/clients/${client.id}/search-criteria/${c.id}`, { method: "PUT", body: { is_active: !c.is_active } }), { invalidate });
  const remove = useApiMutation((c: SearchCriterion) => api(`/clients/${client.id}/search-criteria/${c.id}`, { method: "DELETE" }), { invalidate });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <h2 className="font-semibold">Ce qu'il cherche</h2>
        {!client.search_criteria?.length ? <EmptyState>Aucun critère. Ajoutez-en pour être prévenu quand un bien correspond.</EmptyState> : client.search_criteria.map((c) => (
          <Card key={c.id} className={`p-4 text-sm ${c.is_active ? "" : "opacity-60"}`}>
            <p className="font-medium">
              {c.transaction.label}{c.types.length ? ` · ${c.types.map((t) => t.label).join(", ")}` : ""}
            </p>
            <p className="text-muted-foreground">
              {c.budget_min || c.budget_max ? `Budget ${c.budget_min ? formatPrice(c.budget_min) : "—"} à ${c.budget_max ? formatPrice(c.budget_max) : "—"}` : "Budget non précisé"}
              {c.rooms_min ? ` · ${c.rooms_min} pièces min.` : ""}
            </p>
            {(c.cities.length > 0 || c.neighborhoods.length > 0) && <p className="text-muted-foreground">{[...c.cities, ...c.neighborhoods].join(", ")}</p>}
            {editable && (
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => toggle.mutate(c)}>{c.is_active ? "Mettre en pause" : "Réactiver"}</Button>
                <Button size="sm" variant="ghost" onClick={() => remove.mutate(c)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            )}
          </Card>
        ))}

        {editable && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Ajouter des critères</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={(e) => { e.preventDefault(); add.mutate(undefined); }} className="space-y-3">
                <Select value={form.transaction} onValueChange={(v) => setForm({ ...form, transaction: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{transactions.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
                <div className="flex flex-wrap gap-3">
                  {types.map((t) => (
                    <label key={t.value} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={form.types.includes(t.value)} onCheckedChange={(v) =>
                        setForm({ ...form, types: v === true ? [...form.types, t.value] : form.types.filter((x) => x !== t.value) })} />
                      {t.label}
                    </label>
                  ))}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Budget min (FCFA)" htmlFor="bmin"><Input id="bmin" inputMode="numeric" value={form.budget_min} onChange={(e) => setForm({ ...form, budget_min: e.target.value })} /></Field>
                  <Field label="Budget max (FCFA)" htmlFor="bmax" error={add.error?.field("budget_max")}><Input id="bmax" inputMode="numeric" value={form.budget_max} onChange={(e) => setForm({ ...form, budget_max: e.target.value })} /></Field>
                  <Field label="Pièces min" htmlFor="rmin"><Input id="rmin" inputMode="numeric" value={form.rooms_min} onChange={(e) => setForm({ ...form, rooms_min: e.target.value })} /></Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Villes" htmlFor="cities" hint="Séparées par des virgules ; vide = indifférent."><Input id="cities" value={form.cities} onChange={(e) => setForm({ ...form, cities: e.target.value })} /></Field>
                  <Field label="Quartiers" htmlFor="nbh" hint="« Sacré-Cœur » trouve aussi « Sacré-Cœur 3 »."><Input id="nbh" value={form.neighborhoods} onChange={(e) => setForm({ ...form, neighborhoods: e.target.value })} /></Field>
                </div>
                <Button type="submit" variant="gold" disabled={add.isPending}>Ajouter</Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold">Biens qui correspondent ({matches?.length ?? 0})</h2>
        {!matches?.length ? <EmptyState>Aucun bien publié ne correspond pour l'instant.</EmptyState> : matches.map((p) => (
          <Link key={p.id} to={`/admin/biens/${p.id}`}>
            <Card className="mb-2 flex gap-3 p-3 transition-shadow hover:shadow-md">
              <div className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                {p.cover_url ? <img src={p.cover_url} alt="" className="h-full w-full object-cover" /> : <Home className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div className="min-w-0 text-sm">
                <p className="line-clamp-1 font-medium">{p.title}</p>
                <p className="text-muted-foreground">{p.reference} · {p.neighborhood}</p>
                <p className="font-semibold text-accent">{formatPrice(p.price, p.transaction.value === "location")}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function DocumentsTab({ client }: { client: Client }) {
  const types = useOptions("client_document_types");
  const [type, setType] = useState("cni");
  const key = ["client-documents", client.id];
  const { data } = useQuery({ queryKey: key, queryFn: () => api<{ data: DocumentItem[] }>(`/clients/${client.id}/documents`).then((r) => r.data) });
  const upload = useApiMutation(
    (file: File) => {
      const body = new FormData();
      body.append("type", type);
      body.append("document", file);
      return api(`/clients/${client.id}/documents`, { method: "POST", body });
    },
    { success: "Pièce ajoutée.", invalidate: [key] },
  );
  const remove = useApiMutation((docId: number) => api(`/clients/${client.id}/documents/${docId}`, { method: "DELETE" }), { invalidate: [key] });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Pièces d'identité : visibles uniquement par le dirigeant et l'agent qui suit le client. Chaque consultation est enregistrée.</p>
      <div className="flex flex-wrap items-end gap-3">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>{types.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
        <Button asChild variant="gold">
          <label className="cursor-pointer">
            <Upload className="h-4 w-4" /> Envoyer
            <input type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
          </label>
        </Button>
      </div>
      {upload.error && <FormError message={upload.error.field("document") ?? upload.error.message} />}
      {!data?.length ? <EmptyState>Aucune pièce.</EmptyState> : (
        <Card className="divide-y">
          {data.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between p-3 text-sm">
              <div><p className="font-medium">{doc.original_name}</p><p className="text-xs text-muted-foreground">{doc.type.label} · {formatDate(doc.created_at)}</p></div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => downloadFile(`/clients/${client.id}/documents/${doc.id}`, doc.original_name)} aria-label="Télécharger"><Download className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => confirm("Supprimer cette pièce ?") && remove.mutate(doc.id)} aria-label="Supprimer"><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function EditClient({ client }: { client: Client }) {
  const mutation = useApiMutation((body: Record<string, unknown>) => api(`/clients/${client.id}`, { method: "PUT", body }), {
    success: "Fiche enregistrée.",
    invalidate: [["client", String(client.id)], ["clients"]],
  });
  return <ClientForm client={client} error={mutation.error} pending={mutation.isPending} onSubmit={(p) => mutation.mutate(p)} />;
}
