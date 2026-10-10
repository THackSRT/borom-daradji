import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Archive, ArrowLeft, CalendarDays, CalendarPlus, Check, ClipboardList, Download, FileText, Globe, Home, Mail, MapPin,
  MessageCircle, MoreHorizontal, Phone, PhoneCall, Search, Trash2, Upload, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, downloadFile } from "@/lib/api";
import { formatDate, formatDateTime, formatPrice, fromNow } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth } from "../auth";
import { useApiMutation, useOptions } from "../hooks";
import type { Client, DocumentItem, Interaction, Invoice, InvoiceSummary, Paginated, Property, SearchCriterion, Visit } from "../types";
import { ClientForm } from "../components/ClientForm";
import { cfa, InvoiceStateBadge } from "../components/billing";
import { useQuickCreate } from "../components/QuickCreate";
import { PlanVisitDialog, VisitReportDialog } from "../components/VisitDialogs";
import { Avatar, EmptyState, Field, FormError, LoadingBlock, Panel, StatusBadge, WhatsAppLink } from "../components/ui";

const channelIcons: Record<string, typeof Phone> = {
  appel: PhoneCall,
  whatsapp: MessageCircle,
  sms: MessageCircle,
  email: Mail,
  visite: Home,
  rencontre: Users,
  formulaire_site: Globe,
};

export default function ClientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const quickCreate = useQuickCreate();
  const canSeeInvoices = can("invoices.view");
  const key = ["client", id];
  const { data: client, isLoading } = useQuery({ queryKey: key, queryFn: () => api<{ data: Client }>(`/clients/${id}`).then((r) => r.data) });
  const [planning, setPlanning] = useState(false);
  const [reporting, setReporting] = useState<Visit | null>(null);

  const archive = useApiMutation(() => api(`/clients/${id}`, { method: "DELETE" }), {
    success: "Client archivé.",
    invalidate: [["clients"]],
    onSuccess: () => navigate("/admin/clients"),
  });

  if (isLoading || !client) return <LoadingBlock rows={6} />;
  const prospection = can("clients.prospection");
  const openVisit = (v: Visit) => setReporting({ ...v, client: { id: client.id, name: client.name, phone: client.phone, whatsapp_url: client.whatsapp_url } });

  return (
    <>
      <Link to="/admin/clients" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Tous les clients
      </Link>

      <section className="mb-6 rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <Avatar name={client.name} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{client.name}</h1>
              {client.categories.map((c) => <span key={c.value} className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{c.label}</span>)}
              {client.tags.map((t) => <span key={t} className="rounded-md border border-gold/40 bg-gold/10 px-2 py-0.5 text-xs font-medium text-gold">{t}</span>)}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {client.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{client.phone}</span>}
              {client.email && <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{client.email}</span>}
              {client.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{client.city}</span>}
              <span>Dernier contact : <span className={cn(!client.last_contact_at && "font-medium text-amber-700")}>{client.last_contact_at ? fromNow(client.last_contact_at) : "jamais"}</span></span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {client.phone && <Button asChild variant="outline"><a href={`tel:${client.phone}`}><Phone className="h-4 w-4" /> Appeler</a></Button>}
            <WhatsAppLink url={client.whatsapp_url} />
            {prospection && <Button onClick={() => setPlanning(true)}><CalendarPlus className="h-4 w-4" /> Planifier une visite</Button>}
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="Plus d'actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => quickCreate.open("task", { client, title: `Rappeler ${client.name}` })}><ClipboardList className="mr-2 h-4 w-4" /> Créer un rappel</DropdownMenuItem>
                {client.email && <DropdownMenuItem asChild><a href={`mailto:${client.email}`}><Mail className="mr-2 h-4 w-4" /> Écrire un email</a></DropdownMenuItem>}
                {client.can.delete && <DropdownMenuItem className="text-destructive" onClick={() => confirm(`Archiver ${client.name} ?`) && archive.mutate(undefined)}><Archive className="mr-2 h-4 w-4" /> Archiver</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <PipelineStepper client={client} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Tabs defaultValue="activite" className="min-w-0">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
            {[
              ["activite", "Activité"],
              ["recherche", "Recherche"],
              ...(client.can.view_documents ? [["pieces", "Pièces"]] : []),
              ...(canSeeInvoices ? [["factures", "Factures"]] : []),
              ["infos", "Informations"],
            ].map(([value, label]) => (
              <TabsTrigger key={value} value={value} className="rounded-lg border border-transparent px-3 py-1.5 data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:shadow-sm">{label}</TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="activite" className="mt-4 space-y-4">
            <Composer client={client} />
            <Timeline interactions={client.interactions ?? []} visits={client.visits ?? []} onVisit={prospection ? openVisit : undefined} />
          </TabsContent>
          <TabsContent value="recherche" className="mt-4"><SearchTab client={client} editable={prospection} /></TabsContent>
          {client.can.view_documents && <TabsContent value="pieces" className="mt-4"><DocumentsTab client={client} /></TabsContent>}
          {canSeeInvoices && <TabsContent value="factures" className="mt-4"><ClientInvoices client={client} /></TabsContent>}
          <TabsContent value="infos" className="mt-4"><Panel><EditClient client={client} /></Panel></TabsContent>
        </Tabs>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Panel title="Suivi">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Suivi par</dt><dd className="flex items-center gap-2 font-medium">{client.assigned_user ? <><Avatar name={client.assigned_user.name} size="sm" />{client.assigned_user.name}</> : "—"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Origine</dt><dd className="font-medium">{client.source?.label ?? "—"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Client depuis</dt><dd className="font-medium">{formatDate(client.created_at)}</dd></div>
              {client.solvency && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Solvabilité</dt><dd className="font-medium">{client.solvency}</dd></div>}
            </dl>
          </Panel>
          {client.private_notes !== undefined && (
            <Panel title="Notes privées" description="Vous et le dirigeant uniquement.">
              <p className="whitespace-pre-line text-sm">{client.private_notes || <span className="text-muted-foreground">Aucune note.</span>}</p>
            </Panel>
          )}
          {!!client.search_criteria?.length && (
            <Panel title="Recherche en cours">
              {client.search_criteria.filter((c) => c.is_active).map((c) => <CriterionSummary key={c.id} criterion={c} />)}
            </Panel>
          )}
        </aside>
      </div>

      <PlanVisitDialog open={planning} onOpenChange={setPlanning} client={client} />
      {reporting && <VisitReportDialog visit={reporting} onClose={() => setReporting(null)} />}
    </>
  );
}

/** Étapes du prospect, cliquables. */
function PipelineStepper({ client }: { client: Client }) {
  const stages = useOptions("pipeline_statuses");
  const move = useApiMutation((stage: string) => api(`/clients/${client.id}`, { method: "PUT", body: { pipeline_status: stage } }), {
    success: "Étape mise à jour.",
    invalidate: [["client", String(client.id)], ["clients"], ["dashboard"]],
  });
  const path = stages.filter((s) => s.value !== "perdu");
  const current = path.findIndex((s) => s.value === client.pipeline_status.value);
  const lost = client.pipeline_status.value === "perdu";

  return (
    <div className="mt-5 flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center">
      {/* Téléphone : liste déroulante, les étapes ne tiennent pas en largeur. */}
      <div className="sm:hidden">
        <Select value={client.pipeline_status.value} onValueChange={(v) => move.mutate(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{stages.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="hidden flex-1 overflow-x-auto sm:flex">
        {path.map((s, i) => {
          const done = !lost && i <= current;
          return (
            <button key={s.value} type="button" onClick={() => move.mutate(s.value)} disabled={move.isPending}
              className={cn(
                "relative flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap px-3 py-2 text-xs font-medium transition first:rounded-l-lg last:rounded-r-lg",
                done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70",
                i === current && !lost && "ring-2 ring-primary ring-offset-1",
              )}>
              {done && i < current && <Check className="h-3.5 w-3.5" />}{s.label}
            </button>
          );
        })}
      </div>
      <Button variant="ghost" size="sm" className={cn("hidden text-muted-foreground sm:inline-flex", lost && "bg-slate-200 text-slate-700")} onClick={() => move.mutate(lost ? "contacte" : "perdu")}>
        {lost ? "Réactiver" : "Marquer perdu"}
      </Button>
    </div>
  );
}

/** Noter un échange en deux gestes : canal, résumé. */
function Composer({ client }: { client: Client }) {
  const channels = useOptions("interaction_channels").filter((c) => c.value !== "formulaire_site");
  const [channel, setChannel] = useState("appel");
  const [summary, setSummary] = useState("");
  const add = useApiMutation(() => api(`/clients/${client.id}/interactions`, { method: "POST", body: { channel, summary } }), {
    success: "Échange enregistré.",
    invalidate: [["client", String(client.id)], ["clients"], ["dashboard"]],
    onSuccess: () => setSummary(""),
  });

  return (
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); add.mutate(undefined); }} className="rounded-xl border bg-card p-3 shadow-sm">
      <div className="mb-2 flex flex-wrap gap-1">
        {channels.map((c) => {
          const Icon = channelIcons[c.value] ?? MessageCircle;
          return (
            <button key={c.value} type="button" onClick={() => setChannel(c.value)}
              className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition", channel === c.value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted")}>
              <Icon className="h-3.5 w-3.5" />{c.label}
            </button>
          );
        })}
      </div>
      <Textarea rows={2} className="resize-none border-0 bg-transparent px-1 shadow-none focus-visible:ring-0" placeholder="Qu'est-ce qui a été dit ou convenu ?" value={summary} onChange={(e) => setSummary(e.target.value)} />
      <div className="flex justify-end"><Button type="submit" size="sm" disabled={!summary.trim() || add.isPending}>Enregistrer l'échange</Button></div>
    </form>
  );
}

type TimelineEntry = { kind: "interaction"; at: string; item: Interaction } | { kind: "visit"; at: string; item: Visit };

function Timeline({ interactions, visits, onVisit }: { interactions: Interaction[]; visits: Visit[]; onVisit?: (v: Visit) => void }) {
  const entries = useMemo<TimelineEntry[]>(() => [
    ...interactions.filter((i) => i.channel.value !== "visite").map((i) => ({ kind: "interaction" as const, at: i.occurred_at, item: i })),
    ...visits.map((v) => ({ kind: "visit" as const, at: v.scheduled_at, item: v })),
  ].sort((a, b) => b.at.localeCompare(a.at)), [interactions, visits]);

  if (!entries.length) return <EmptyState icon={MessageCircle} title="Pas encore d'historique">Notez le premier appel ou message ci-dessus.</EmptyState>;

  return (
    <ol className="relative ml-4 border-l pl-6">
      {entries.map((e) => {
        if (e.kind === "visit") {
          const v = e.item;
          const upcoming = v.status.value === "planifiee";
          return (
            <li key={`v${v.id}`} className="relative mb-4">
              <span className={cn("absolute -left-[37px] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-slate-50", upcoming ? "bg-blue-100 text-blue-700" : "bg-violet-100 text-violet-700")}><CalendarDays className="h-3.5 w-3.5" /></span>
              <div className={cn("rounded-xl border bg-card p-4 shadow-sm", upcoming && "border-blue-200")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">Visite {v.property && <Link to={`/admin/biens/${v.property.id}`} className="text-primary hover:underline">{v.property.reference}</Link>}</p>
                  <div className="flex items-center gap-2"><StatusBadge option={v.status} />{v.feedback && <StatusBadge option={v.feedback} />}</div>
                </div>
                <p className="text-xs text-muted-foreground">{formatDateTime(v.scheduled_at)} · {v.property?.title}</p>
                {v.notes && <p className="mt-2 text-sm">{v.notes}</p>}
                {onVisit && <Button size="sm" variant="outline" className="mt-3" onClick={() => onVisit(v)}>{upcoming ? "Faire le compte-rendu" : "Modifier"}</Button>}
              </div>
            </li>
          );
        }
        const i = e.item;
        const Icon = channelIcons[i.channel.value] ?? MessageCircle;
        return (
          <li key={`i${i.id}`} className="relative mb-4">
            <span className="absolute -left-[37px] flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground ring-4 ring-slate-50"><Icon className="h-3.5 w-3.5" /></span>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span><span className="font-medium text-foreground">{i.channel.label}</span> · {i.user?.name ?? "Site internet"}{i.property && <> · <Link to={`/admin/biens/${i.property.id}`} className="font-mono hover:text-primary">{i.property.reference}</Link></>}</span>
                <span>{formatDateTime(i.occurred_at)}</span>
              </div>
              <p className="whitespace-pre-line text-sm">{i.summary}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function CriterionSummary({ criterion: c }: { criterion: SearchCriterion }) {
  return (
    <div className="space-y-1 text-sm [&:not(:last-child)]:mb-3 [&:not(:last-child)]:border-b [&:not(:last-child)]:pb-3">
      <p className="font-medium">{c.transaction.label}{c.types.length ? ` · ${c.types.map((t) => t.label).join(", ")}` : ""}</p>
      <p className="text-muted-foreground">{c.budget_max ? `Jusqu'à ${formatPrice(c.budget_max)}` : "Budget non précisé"}{c.rooms_min ? ` · ${c.rooms_min}+ pièces` : ""}</p>
      {(c.cities.length > 0 || c.neighborhoods.length > 0) && <p className="text-xs text-muted-foreground">{[...c.cities, ...c.neighborhoods].join(", ")}</p>}
    </div>
  );
}

function SearchTab({ client, editable }: { client: Client; editable: boolean }) {
  const transactions = useOptions("transaction_types");
  const types = useOptions("property_types");
  const empty = { transaction: "vente", types: [] as string[], budget_min: "", budget_max: "", cities: "", neighborhoods: "", rooms_min: "" };
  const [form, setForm] = useState(empty);
  const [adding, setAdding] = useState(false);
  const invalidate = [["client", String(client.id)], ["matches", client.id]];
  const { data: matches } = useQuery({ queryKey: ["matches", client.id], queryFn: () => api<{ data: Property[] }>(`/clients/${client.id}/matches`).then((r) => r.data) });
  const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
  const add = useApiMutation(() => api(`/clients/${client.id}/search-criteria`, {
    method: "POST",
    body: {
      transaction: form.transaction, types: form.types,
      budget_min: form.budget_min ? Number(form.budget_min) : null, budget_max: form.budget_max ? Number(form.budget_max) : null,
      cities: list(form.cities), neighborhoods: list(form.neighborhoods), rooms_min: form.rooms_min ? Number(form.rooms_min) : null,
    },
  }), { success: "Critères enregistrés. Vous serez prévenu dès qu'un bien correspond.", invalidate, onSuccess: () => { setForm(empty); setAdding(false); } });
  const toggle = useApiMutation((c: SearchCriterion) => api(`/clients/${client.id}/search-criteria/${c.id}`, { method: "PUT", body: { is_active: !c.is_active } }), { invalidate });
  const remove = useApiMutation((c: SearchCriterion) => api(`/clients/${client.id}/search-criteria/${c.id}`, { method: "DELETE" }), { invalidate });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Ce qu'il recherche" description="Quand un bien correspondant est publié, l'agent reçoit une tâche."
        action={editable && !adding && <Button size="sm" variant="outline" onClick={() => setAdding(true)}>Ajouter</Button>}>
        {adding && (
          <form onSubmit={(e) => { e.preventDefault(); add.mutate(undefined); }} className="mb-4 space-y-3 rounded-lg bg-muted/40 p-3">
            <Select value={form.transaction} onValueChange={(v) => setForm({ ...form, transaction: v })}>
              <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>{transactions.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
            <div className="flex flex-wrap gap-3">
              {types.map((t) => (
                <label key={t.value} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={form.types.includes(t.value)} onCheckedChange={(v) => setForm({ ...form, types: v === true ? [...form.types, t.value] : form.types.filter((x) => x !== t.value) })} />{t.label}
                </label>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Budget min" htmlFor="bmin"><Input id="bmin" className="bg-card" inputMode="numeric" value={form.budget_min} onChange={(e) => setForm({ ...form, budget_min: e.target.value })} /></Field>
              <Field label="Budget max" htmlFor="bmax" error={add.error?.field("budget_max")}><Input id="bmax" className="bg-card" inputMode="numeric" value={form.budget_max} onChange={(e) => setForm({ ...form, budget_max: e.target.value })} /></Field>
              <Field label="Pièces min" htmlFor="rmin"><Input id="rmin" className="bg-card" inputMode="numeric" value={form.rooms_min} onChange={(e) => setForm({ ...form, rooms_min: e.target.value })} /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Villes" htmlFor="cities" hint="Séparées par des virgules"><Input id="cities" className="bg-card" value={form.cities} onChange={(e) => setForm({ ...form, cities: e.target.value })} /></Field>
              <Field label="Quartiers" htmlFor="nbh" hint="« Sacré-Cœur » inclut « Sacré-Cœur 3 »"><Input id="nbh" className="bg-card" value={form.neighborhoods} onChange={(e) => setForm({ ...form, neighborhoods: e.target.value })} /></Field>
            </div>
            <div className="flex gap-2"><Button type="submit" size="sm" disabled={add.isPending}>Enregistrer</Button><Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>Annuler</Button></div>
          </form>
        )}
        {!client.search_criteria?.length ? (!adding && <EmptyState icon={Search} compact>Aucun critère. Ajoutez-en pour recevoir les biens correspondants.</EmptyState>) : (
          <div className="space-y-3">
            {client.search_criteria.map((c) => (
              <div key={c.id} className={cn("rounded-lg border p-3", !c.is_active && "opacity-60")}>
                <CriterionSummary criterion={c} />
                {editable && (
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => toggle.mutate(c)}>{c.is_active ? "Mettre en pause" : "Réactiver"}</Button>
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => remove.mutate(c)} aria-label="Supprimer"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title={`Biens correspondants (${matches?.length ?? 0})`} description="Biens en ligne compatibles, budget ±10 %." bodyClassName="p-2">
        {!matches?.length ? <EmptyState icon={Home} compact>Aucun bien en ligne ne correspond pour l'instant.</EmptyState> : (
          <div className="divide-y">
            {matches.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-2 py-2.5">
                <Link to={`/admin/biens/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                    {p.cover_url ? <img src={p.cover_url} alt="" className="h-full w-full object-cover" /> : <Home className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium hover:text-primary">{p.title}</p>
                    <p className="text-xs text-muted-foreground">{formatPrice(p.price, p.transaction.value === "location")} · {p.neighborhood}</p>
                  </div>
                </Link>
                <WhatsAppLink size="icon" url={client.whatsapp_url ? `${client.whatsapp_url}?text=${encodeURIComponent(`Bonjour ${client.name}, ce bien pourrait vous intéresser : ${p.title} (${p.reference}) à ${formatPrice(p.price, p.transaction.value === "location")}. Voulez-vous le visiter ?`)}` : null} />
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function DocumentsTab({ client }: { client: Client }) {
  const types = useOptions("client_document_types");
  const [type, setType] = useState("cni");
  const key = ["client-documents", client.id];
  const { data } = useQuery({ queryKey: key, queryFn: () => api<{ data: DocumentItem[] }>(`/clients/${client.id}/documents`).then((r) => r.data) });
  const upload = useApiMutation((file: File) => {
    const body = new FormData();
    body.append("type", type);
    body.append("document", file);
    return api(`/clients/${client.id}/documents`, { method: "POST", body });
  }, { success: "Pièce ajoutée.", invalidate: [key] });
  const remove = useApiMutation((docId: number) => api(`/clients/${client.id}/documents/${docId}`, { method: "DELETE" }), { invalidate: [key] });

  return (
    <Panel title="Pièces d'identité et justificatifs" description="Visibles du dirigeant et de l'agent qui suit le client ; chaque consultation est enregistrée.">
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 p-3">
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-56 bg-card"><SelectValue /></SelectTrigger>
          <SelectContent>{types.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
        <Button asChild size="sm"><label className="cursor-pointer"><Upload className="h-4 w-4" /> Envoyer
          <input type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
        </label></Button>
      </div>
      {upload.error && <div className="mb-3"><FormError message={upload.error.field("document") ?? upload.error.message} /></div>}
      {!data?.length ? <EmptyState icon={FileText} compact>Aucune pièce.</EmptyState> : (
        <div className="divide-y rounded-lg border">
          {data.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 p-3 text-sm">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div className="min-w-0 flex-1"><p className="truncate font-medium">{doc.original_name}</p><p className="text-xs text-muted-foreground">{doc.type.label} · {formatDate(doc.created_at)}</p></div>
              <Button size="icon" variant="ghost" onClick={() => downloadFile(`/clients/${client.id}/documents/${doc.id}`, doc.original_name)} aria-label="Télécharger"><Download className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => confirm("Supprimer cette pièce ?") && remove.mutate(doc.id)} aria-label="Supprimer"><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function EditClient({ client }: { client: Client }) {
  const mutation = useApiMutation((body: Record<string, unknown>) => api(`/clients/${client.id}`, { method: "PUT", body }), {
    success: "Fiche enregistrée.",
    invalidate: [["client", String(client.id)], ["clients"]],
  });
  return <ClientForm client={client} error={mutation.error} pending={mutation.isPending} onSubmit={(p) => mutation.mutate(p)} />;
}

/** Factures du client et reste à payer ; création d'une facture déjà rattachée à lui. */
function ClientInvoices({ client }: { client: Client }) {
  const { can } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["invoices", { client_id: client.id }],
    queryFn: () => api<Paginated<Invoice> & { summary: InvoiceSummary }>("/invoices", { query: { client_id: client.id, per_page: 50 } }),
  });
  if (isLoading) return <LoadingBlock rows={2} />;
  const invoices = data?.data ?? [];
  const due = invoices.reduce((sum, inv) => sum + Math.max(0, inv.balance), 0);
  return (
    <Panel
      title="Factures"
      description={invoices.length ? `Reste à payer : ${cfa(due)}` : undefined}
      action={can("invoices.manage") && (
        <Button size="sm" onClick={() => navigate(`/admin/factures/nouvelle?client=${client.id}&nom=${encodeURIComponent(client.name)}`)}>Nouvelle facture</Button>
      )}
    >
      {!invoices.length ? <p className="text-sm text-muted-foreground">Aucune facture pour ce client.</p> : (
        <ul className="divide-y">
          {invoices.map((inv) => (
            <li key={inv.id}>
              <Link to={`/admin/factures/${inv.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:bg-muted/30">
                <span className="min-w-0">
                  <span className="block font-medium">{inv.number ?? "Brouillon"}{inv.type.value === "avoir" && " (avoir)"}</span>
                  <span className="text-xs text-muted-foreground">{inv.issue_date ? formatDate(inv.issue_date) : "Non émise"} · {cfa(inv.total)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  {inv.balance > 0 && <span className="tabular-nums text-muted-foreground">reste {cfa(inv.balance)}</span>}
                  <InvoiceStateBadge invoice={inv} />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
