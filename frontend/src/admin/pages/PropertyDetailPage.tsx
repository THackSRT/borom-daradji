import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Archive, ArrowDown, ArrowLeft, ArrowUp, Bath, BedDouble, Check, CheckCircle2, Circle, Download, ExternalLink, FileText,
  Globe, Home, Maximize, Minus, MoreHorizontal, Star, Trash2, Upload, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, downloadFile } from "@/lib/api";
import { formatDate, formatDateTime, formatPrice, fromNow } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApiMutation, useOptions } from "../hooks";
import type { DocumentItem, Mandate, Option, Property, PropertyCheck } from "../types";
import { PropertyForm } from "../components/PropertyForm";
import { Avatar, EmptyState, Field, FormError, LoadingBlock, Panel, ProgressBar, StatusBadge, WhatsAppLink } from "../components/ui";

const PUBLIC = ["disponible", "en_negociation"];

export default function PropertyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: property, isLoading } = useQuery({
    queryKey: ["property", id],
    queryFn: () => api<{ data: Property }>(`/properties/${id}`).then((r) => r.data),
  });
  const [statusTarget, setStatusTarget] = useState<string | null>(null);
  const [tab, setTab] = useState("verification");

  const archive = useApiMutation(() => api(`/properties/${id}`, { method: "DELETE" }), {
    success: "Bien archivé.",
    invalidate: [["properties"], ["dashboard"]],
    onSuccess: () => navigate("/admin/biens"),
  });

  if (isLoading || !property) return <LoadingBlock rows={6} />;

  const checks = property.checks ?? [];
  const cleared = checks.filter((c) => c.is_cleared).length;
  const isPublic = PUBLIC.includes(property.status.value);
  const photos = property.photos ?? [];
  const cover = photos.find((p) => p.is_cover) ?? photos[0];

  return (
    <>
      <Link to="/admin/biens" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Tous les biens
      </Link>

      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">{property.reference}</span>
            <StatusBadge option={property.status} />
            {isPublic && <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><Globe className="h-3.5 w-3.5" /> En ligne {fromNow(property.published_at)}</span>}
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-[1.75rem]">{property.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{[property.neighborhood, property.city].filter(Boolean).join(", ")} · {property.type.label} · {property.transaction.label}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isPublic && (
            <Button asChild variant="outline"><a href={`/biens/${property.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Voir sur le site</a></Button>
          )}
          {property.can.update && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="Plus d'actions"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setStatusTarget("")}>Changer le statut…</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => confirm("Archiver ce bien ? Il disparaîtra des listes et du site.") && archive.mutate(undefined)}>
                  <Archive className="mr-2 h-4 w-4" /> Archiver
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          {/* Galerie */}
          <div className="grid gap-2 overflow-hidden rounded-xl sm:grid-cols-4 sm:grid-rows-2">
            <div className="relative col-span-4 row-span-2 aspect-[16/9] bg-muted sm:col-span-3 sm:aspect-auto sm:min-h-[320px]">
              {cover ? <img src={cover.url} alt="" className="absolute inset-0 h-full w-full object-cover" /> : (
                <button type="button" onClick={() => setTab("photos")} className="flex h-full w-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Home className="h-8 w-8" /> Ajouter des photos
                </button>
              )}
            </div>
            {photos.filter((p) => p.id !== cover?.id).slice(0, 2).map((p, i) => (
              <button key={p.id} type="button" onClick={() => setTab("photos")} className="relative hidden aspect-[4/3] overflow-hidden bg-muted sm:block sm:aspect-auto">
                <img src={p.url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                {i === 1 && photos.length > 3 && <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-medium text-white">+{photos.length - 3} photos</span>}
              </button>
            ))}
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
              {[
                ["verification", `Vérification foncière`, `${cleared}/${checks.length}`],
                ["photos", "Photos", String(photos.length)],
                ["fiche", "Fiche", null],
                ...(property.can.view_documents ? [["documents", "Pièces", null], ["mandats", "Mandats", null]] : []),
                ["historique", "Historique", null],
              ].map(([value, label, count]) => (
                <TabsTrigger key={value} value={value!} className="rounded-lg border border-transparent px-3 py-1.5 data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:shadow-sm">
                  {label}{count && <span className="ml-1.5 rounded-full bg-muted px-1.5 text-xs tabular-nums">{count}</span>}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="verification" className="mt-4">
              <Panel title="Vérification foncière" description="Chaque point doit être « vérifié » ou « sans objet » pour publier. L'état des droits réels doit dater de moins de 90 jours." bodyClassName="divide-y p-0">
                {checks.map((check, i) => <CheckRow key={check.id} index={i + 1} propertyId={property.id} check={check} editable={property.can.update} />)}
              </Panel>
            </TabsContent>

            <TabsContent value="photos" className="mt-4"><PhotosTab property={property} /></TabsContent>
            <TabsContent value="fiche" className="mt-4">
              <Panel>{property.can.update ? <EditForm property={property} /> : <p className="whitespace-pre-line text-sm">{property.description}</p>}</Panel>
            </TabsContent>
            {property.can.view_documents && <TabsContent value="documents" className="mt-4"><DocumentsTab property={property} /></TabsContent>}
            {property.can.view_documents && <TabsContent value="mandats" className="mt-4"><MandatesTab property={property} /></TabsContent>}
            <TabsContent value="historique" className="mt-4"><HistoryTab property={property} /></TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <PublicationCard property={property} cleared={cleared} onStatus={setStatusTarget} onShowChecks={() => setTab("verification")} />

          <Panel title="En bref">
            <p className="mb-4 text-2xl font-semibold tabular-nums">{formatPrice(property.price, property.transaction.value === "location")}</p>
            {property.transaction.value === "location" && (property.deposit_months || property.advance_months) && (
              <p className="-mt-3 mb-4 text-xs text-muted-foreground">
                Caution {property.deposit_months ?? 0} mois · avance {property.advance_months ?? 0} mois{property.charges ? ` · charges ${formatPrice(property.charges)}` : ""}
              </p>
            )}
            <div className="grid grid-cols-3 gap-2 text-center">
              <Fact icon={Maximize} value={property.surface ? `${property.surface} m²` : "—"} label="Surface" />
              <Fact icon={BedDouble} value={property.bedrooms ?? "—"} label="Chambres" />
              <Fact icon={Bath} value={property.bathrooms ?? "—"} label="Sdb" />
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <Row label="Situation juridique" value={property.land_status.label} />
              {property.land_reference && <Row label="Référence" value={property.land_reference} />}
              {property.land_surface && <Row label="Terrain" value={`${property.land_surface} m²`} />}
            </dl>
            {property.features.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {property.features.map((f) => <span key={f} className="rounded-md bg-muted px-2 py-0.5 text-xs">{f}</span>)}
              </div>
            )}
          </Panel>

          <Panel title="Contacts">
            <div className="space-y-3 text-sm">
              {property.agent && <div className="flex items-center gap-3"><Avatar name={property.agent.name} size="sm" /><div><p className="font-medium">{property.agent.name}</p><p className="text-xs text-muted-foreground">Agent responsable</p></div></div>}
              {property.owner ? (
                <div className="flex items-center gap-3">
                  <Avatar name={property.owner.name} size="sm" />
                  <Link to={`/admin/clients/${property.owner.id}`} className="min-w-0 flex-1 hover:text-primary"><p className="truncate font-medium">{property.owner.name}</p><p className="text-xs text-muted-foreground">Propriétaire · {property.owner.phone}</p></Link>
                </div>
              ) : <p className="text-xs text-muted-foreground">Propriétaire non renseigné.</p>}
            </div>
          </Panel>
        </aside>
      </div>

      {statusTarget !== null && <StatusDialog property={property} initial={statusTarget} onClose={() => setStatusTarget(null)} />}
    </>
  );
}

function Fact({ icon: Icon, value, label }: { icon: typeof Maximize; value: string | number; label: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2">
      <Icon className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
      <p className="text-sm font-semibold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium">{value}</dd></div>;
}

/** Ce qui manque pour publier, ou les actions suivantes une fois en ligne. */
function PublicationCard({ property, cleared, onStatus, onShowChecks }: { property: Property; cleared: number; onStatus: (s: string) => void; onShowChecks: () => void }) {
  const checks = property.checks ?? [];
  const ready = cleared === checks.length;
  const status = property.status.value;
  const publish = useApiMutation(() => api(`/properties/${property.id}/status`, { method: "POST", body: { status: "disponible" } }), {
    success: "Bien publié sur le site. Les prospects correspondants ont été signalés aux agents.",
    invalidate: [["property", String(property.id)], ["properties"], ["dashboard"], ["tasks"]],
  });

  if (PUBLIC.includes(status) || status === "sous_promesse") {
    const next: Option[] = [
      ...(status === "disponible" ? [{ value: "en_negociation", label: "En négociation" }] : []),
      ...(status !== "sous_promesse" ? [{ value: "sous_promesse", label: "Promesse signée" }] : []),
      property.transaction.value === "location" ? { value: "loue", label: "Loué" } : { value: "vendu", label: "Vendu" },
    ];
    return (
      <Panel className="border-emerald-200 bg-emerald-50/40">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
          <div>
            <p className="text-sm font-semibold">{status === "sous_promesse" ? "Promesse signée" : "En ligne sur le site"}</p>
            <p className="text-xs text-muted-foreground">Publié le {formatDate(property.published_at)}</p>
          </div>
        </div>
        {property.can.update && (
          <div className="mt-4 grid gap-2">
            <p className="text-xs font-medium text-muted-foreground">Étape suivante</p>
            <div className="flex flex-wrap gap-2">
              {next.map((s) => <Button key={s.value} size="sm" variant="outline" className="bg-card" onClick={() => onStatus(s.value)}>{s.label}</Button>)}
              <Button size="sm" variant="ghost" onClick={() => onStatus("retire")}>Retirer</Button>
            </div>
          </div>
        )}
      </Panel>
    );
  }

  if (["vendu", "loue"].includes(status)) {
    return (
      <Panel>
        <p className="text-sm font-semibold">{property.status.label}</p>
        <p className="mt-1 text-xs text-muted-foreground">Le bien n'est plus visible sur le site.</p>
        {property.can.update && <Button size="sm" variant="outline" className="mt-3" onClick={() => onStatus("disponible")}>Remettre en {property.transaction.value}</Button>}
      </Panel>
    );
  }

  const missing = checks.filter((c) => !c.is_cleared);
  return (
    <Panel title={ready ? "Prêt à publier" : "Avant de publier"}>
      <ProgressBar value={cleared} total={checks.length} />
      {ready ? (
        <>
          <p className="mt-3 text-sm text-muted-foreground">La vérification foncière est complète. Le bien peut être mis en ligne.</p>
          {property.can.update && (
            <Button className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700" disabled={publish.isPending} onClick={() => publish.mutate(undefined)}>
              <Globe className="h-4 w-4" /> Publier sur le site
            </Button>
          )}
          {publish.error && <div className="mt-3"><FormError message={publish.error.field("status") ?? publish.error.message} /></div>}
        </>
      ) : (
        <>
          <ul className="mt-3 space-y-1.5">
            {missing.map((c) => (
              <li key={c.id} className="flex items-start gap-2 text-sm">
                <Circle className={cn("mt-1 h-2.5 w-2.5 shrink-0", c.status.value === "ko" || c.is_expired ? "fill-red-500 text-red-500" : "text-muted-foreground")} />
                <span>{c.item.label}{c.is_expired && <span className="text-red-600"> (à renouveler)</span>}{c.status.value === "ko" && <span className="text-red-600"> (problème)</span>}</span>
              </li>
            ))}
          </ul>
          <Button variant="outline" size="sm" className="mt-4 w-full" onClick={onShowChecks}>Compléter la vérification</Button>
        </>
      )}
    </Panel>
  );
}

const choices = [
  { value: "ok", label: "Vérifié", icon: Check, active: "border-emerald-500 bg-emerald-500 text-white" },
  { value: "ko", label: "Problème", icon: X, active: "border-red-500 bg-red-500 text-white" },
  { value: "sans_objet", label: "Sans objet", icon: Minus, active: "border-slate-500 bg-slate-500 text-white" },
] as const;

/** Un point de vérification : un clic pour « vérifié » ; une note est demandée pour « problème » ou « sans objet ». */
function CheckRow({ index, propertyId, check, editable }: { index: number; propertyId: number; check: PropertyCheck; editable: boolean }) {
  const [pending, setPending] = useState<string | null>(null);
  const [note, setNote] = useState(check.note ?? "");
  const save = useApiMutation(
    (body: { status: string; note: string | null }) => api(`/properties/${propertyId}/checks/${check.id}`, { method: "PUT", body }),
    { invalidate: [["property", String(propertyId)], ["properties"], ["dashboard"]], onSuccess: () => setPending(null) },
  );

  const choose = (value: string) => {
    if (value === check.status.value) return save.mutate({ status: "a_faire", note: null });
    if (value === "ok") return save.mutate({ status: "ok", note: check.note });
    setPending(value);
  };

  const state = check.is_expired ? "expired" : check.status.value;

  return (
    <div className="px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          state === "ok" || state === "sans_objet" ? "bg-emerald-100 text-emerald-700" : state === "ko" || state === "expired" ? "bg-red-100 text-red-700" : "bg-muted text-muted-foreground",
        )}>
          {state === "ok" || state === "sans_objet" ? <Check className="h-4 w-4" /> : index}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{check.item.label}</p>
          <p className="text-xs text-muted-foreground">
            {check.checked_by ? `${check.status.label} par ${check.checked_by}, ${formatDate(check.checked_at)}` : "À vérifier"}
            {check.is_expired && <span className="font-medium text-red-600"> · à renouveler (plus de 90 jours)</span>}
          </p>
          {check.note && pending === null && <p className="mt-1 text-xs italic text-muted-foreground">« {check.note} »</p>}
        </div>
        {editable && (
          <div className="flex shrink-0 gap-1">
            {choices.map((c) => (
              <button key={c.value} type="button" disabled={save.isPending} onClick={() => choose(c.value)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition",
                  check.status.value === c.value && !check.is_expired ? c.active : "bg-card text-muted-foreground hover:bg-muted",
                )}>
                <c.icon className="h-3.5 w-3.5" />{c.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {pending && (
        <form className="mt-3 flex flex-col gap-2 sm:ml-10 sm:flex-row" onSubmit={(e: FormEvent) => { e.preventDefault(); save.mutate({ status: pending, note }); }}>
          <Input autoFocus placeholder={pending === "ko" ? "Quel est le problème ?" : "Pourquoi ce point ne s'applique pas ?"} value={note} onChange={(e) => setNote(e.target.value)} required />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={save.isPending}>Enregistrer</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setPending(null)}>Annuler</Button>
          </div>
        </form>
      )}
      {save.error?.field("note") && <p className="mt-1 text-xs text-destructive sm:ml-10">{save.error.field("note")}</p>}
    </div>
  );
}

function StatusDialog({ property, initial, onClose }: { property: Property; initial: string; onClose: () => void }) {
  const statuses = useOptions("property_statuses").filter((s) => s.value !== property.status.value && s.value !== "brouillon");
  const [status, setStatus] = useState(initial);
  const [reason, setReason] = useState("");
  const mutation = useApiMutation(() => api(`/properties/${property.id}/status`, { method: "POST", body: { status, reason: reason || null } }), {
    success: "Statut mis à jour.",
    invalidate: [["property", String(property.id)], ["properties"], ["dashboard"], ["tasks"]],
    onSuccess: onClose,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Changer le statut</DialogTitle>
          <DialogDescription>Actuellement : {property.status.label}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(undefined); }} className="space-y-4">
          <Field label="Nouveau statut" htmlFor="status">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status"><SelectValue placeholder="Choisir" /></SelectTrigger>
              <SelectContent>{statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label={status === "retire" ? "Motif (obligatoire)" : "Motif ou commentaire"} htmlFor="reason" error={mutation.error?.field("reason")}>
            <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={status === "retire" ? "Le propriétaire suspend la vente" : ""} />
          </Field>
          <FormError message={mutation.error?.field("status")} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={!status || mutation.isPending}>Valider</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditForm({ property }: { property: Property }) {
  const mutation = useApiMutation((body: Record<string, unknown>) => api(`/properties/${property.id}`, { method: "PUT", body }), {
    success: "Fiche enregistrée.",
    invalidate: [["property", String(property.id)], ["properties"]],
  });
  return <PropertyForm property={property} error={mutation.error} pending={mutation.isPending} onSubmit={(p) => mutation.mutate(p)} />;
}

function PhotosTab({ property }: { property: Property }) {
  const photos = property.photos ?? [];
  const invalidate = [["property", String(property.id)], ["properties"]];
  const upload = useApiMutation((files: FileList) => {
    const body = new FormData();
    Array.from(files).forEach((f) => body.append("photos[]", f));
    return api(`/properties/${property.id}/photos`, { method: "POST", body });
  }, { success: "Photos ajoutées.", invalidate });
  const cover = useApiMutation((photoId: number) => api(`/properties/${property.id}/photos/${photoId}/cover`, { method: "PUT" }), { invalidate });
  const remove = useApiMutation((photoId: number) => api(`/properties/${property.id}/photos/${photoId}`, { method: "DELETE" }), { invalidate });
  const reorder = useApiMutation((ids: number[]) => api(`/properties/${property.id}/photos/order`, { method: "PUT", body: { ids } }), { invalidate });

  const move = (index: number, delta: number) => {
    const ids = photos.map((p) => p.id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    reorder.mutate(ids);
  };

  return (
    <Panel title={`Photos (${photos.length}/20)`} description="Allégées automatiquement pour un chargement rapide sur téléphone. La photo principale apparaît dans les listes et sur le site."
      action={property.can.update && (
        <Button asChild size="sm" disabled={upload.isPending}>
          <label className="cursor-pointer"><Upload className="h-4 w-4" />{upload.isPending ? "Envoi…" : "Ajouter"}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => e.target.files?.length && upload.mutate(e.target.files)} />
          </label>
        </Button>
      )}>
      {upload.error && <div className="mb-3"><FormError message={upload.error.field("photos") ?? upload.error.message} /></div>}
      {!photos.length ? <EmptyState icon={Home} title="Aucune photo" compact>Un bien avec de bonnes photos reçoit beaucoup plus de demandes.</EmptyState> : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {photos.map((photo, index) => (
            <div key={photo.id} className={cn("group relative overflow-hidden rounded-lg border", photo.is_cover && "ring-2 ring-primary ring-offset-2")}>
              <img src={photo.url} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" />
              {photo.is_cover && <span className="absolute left-2 top-2 rounded-md bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">Principale</span>}
              {property.can.update && (
                <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/20" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Avancer"><ArrowUp className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/20" disabled={index === photos.length - 1} onClick={() => move(index, 1)} aria-label="Reculer"><ArrowDown className="h-4 w-4" /></Button>
                  {!photo.is_cover && <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => cover.mutate(photo.id)} aria-label="Photo principale"><Star className="h-4 w-4" /></Button>}
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-white hover:bg-white/20" onClick={() => confirm("Supprimer cette photo ?") && remove.mutate(photo.id)} aria-label="Supprimer"><Trash2 className="h-4 w-4" /></Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function DocumentsTab({ property }: { property: Property }) {
  const types = useOptions("property_document_types");
  const [type, setType] = useState("titre_foncier");
  const key = ["property-documents", property.id];
  const { data } = useQuery({ queryKey: key, queryFn: () => api<{ data: DocumentItem[] }>(`/properties/${property.id}/documents`).then((r) => r.data) });
  const upload = useApiMutation((file: File) => {
    const body = new FormData();
    body.append("type", type);
    body.append("document", file);
    return api(`/properties/${property.id}/documents`, { method: "POST", body });
  }, { success: "Pièce ajoutée.", invalidate: [key] });
  const remove = useApiMutation((docId: number) => api(`/properties/${property.id}/documents/${docId}`, { method: "DELETE" }), { invalidate: [key] });

  return (
    <Panel title="Pièces du dossier" description="Privées : chaque téléchargement est enregistré dans le journal.">
      {property.can.update && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 p-3">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-72 bg-card"><SelectValue /></SelectTrigger>
            <SelectContent>{types.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button asChild size="sm" disabled={upload.isPending}>
            <label className="cursor-pointer"><Upload className="h-4 w-4" /> Envoyer un fichier
              <input type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
            </label>
          </Button>
          <span className="text-xs text-muted-foreground">PDF, JPG ou PNG, 10 Mo max.</span>
        </div>
      )}
      {upload.error && <div className="mb-3"><FormError message={upload.error.field("document") ?? upload.error.message} /></div>}
      {!data?.length ? <EmptyState icon={FileText} title="Aucune pièce" compact>Titre foncier, état des droits réels, mandat signé…</EmptyState> : (
        <div className="divide-y rounded-lg border">
          {data.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 p-3 text-sm">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div className="min-w-0 flex-1"><p className="truncate font-medium">{doc.original_name}</p><p className="text-xs text-muted-foreground">{doc.type.label} · {formatDate(doc.created_at)}</p></div>
              <Button size="icon" variant="ghost" onClick={() => downloadFile(`/properties/${property.id}/documents/${doc.id}`, doc.original_name)} aria-label="Télécharger"><Download className="h-4 w-4" /></Button>
              {property.can.update && <Button size="icon" variant="ghost" onClick={() => confirm("Supprimer cette pièce ?") && remove.mutate(doc.id)} aria-label="Supprimer"><Trash2 className="h-4 w-4" /></Button>}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function MandatesTab({ property }: { property: Property }) {
  const types = useOptions("mandate_types");
  const commissionTypes = useOptions("commission_types");
  const key = ["mandates", property.id];
  const { data } = useQuery({ queryKey: key, queryFn: () => api<{ data: Mandate[] }>(`/properties/${property.id}/mandates`).then((r) => r.data) });
  const empty = { type: "exclusif", starts_on: "", ends_on: "", commission_type: "pourcentage", commission_value: "", conditions: "" };
  const [form, setForm] = useState(empty);
  const create = useApiMutation(
    () => api(`/properties/${property.id}/mandates`, { method: "POST", body: { ...form, commission_value: Number(form.commission_value), conditions: form.conditions || null } }),
    { success: "Mandat enregistré.", invalidate: [key, ["dashboard"]], onSuccess: () => setForm(empty) },
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Mandats">
        {!data?.length ? <EmptyState icon={FileText} compact>Aucun mandat enregistré.</EmptyState> : (
          <div className="space-y-3">
            {data.map((m) => {
              const daysLeft = Math.ceil((new Date(m.ends_on).getTime() - Date.now()) / 86_400_000);
              return (
                <div key={m.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between"><span className="font-medium">Mandat {m.type.label.toLowerCase()}</span><StatusBadge option={m.status} /></div>
                  <p className="mt-1 text-muted-foreground">Du {formatDate(m.starts_on)} au {formatDate(m.ends_on)}
                    {m.status.value === "actif" && daysLeft <= 30 && <span className="font-medium text-amber-700"> · expire dans {daysLeft} j</span>}</p>
                  <p>Commission : <span className="font-medium">{m.commission_type.value === "pourcentage" ? `${m.commission_value} %` : formatPrice(m.commission_value)}</span></p>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
      {property.can.update && (
        <Panel title="Nouveau mandat" description="L'agent est prévenu 7 jours avant l'expiration.">
          <form onSubmit={(e) => { e.preventDefault(); create.mutate(undefined); }} className="space-y-3">
            <Field label="Type" htmlFor="m-type">
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger id="m-type"><SelectValue /></SelectTrigger>
                <SelectContent>{types.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Début" htmlFor="m-start" error={create.error?.field("starts_on")}><Input id="m-start" type="date" value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} required /></Field>
              <Field label="Fin" htmlFor="m-end" error={create.error?.field("ends_on")}><Input id="m-end" type="date" value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} required /></Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Commission" htmlFor="m-ctype">
                <Select value={form.commission_type} onValueChange={(v) => setForm({ ...form, commission_type: v })}>
                  <SelectTrigger id="m-ctype"><SelectValue /></SelectTrigger>
                  <SelectContent>{commissionTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label={form.commission_type === "pourcentage" ? "Taux (%)" : "Montant (FCFA)"} htmlFor="m-cvalue" error={create.error?.field("commission_value")}>
                <Input id="m-cvalue" inputMode="decimal" value={form.commission_value} onChange={(e) => setForm({ ...form, commission_value: e.target.value })} required />
              </Field>
            </div>
            <Field label="Conditions" htmlFor="m-cond"><Textarea id="m-cond" rows={2} value={form.conditions} onChange={(e) => setForm({ ...form, conditions: e.target.value })} /></Field>
            <Button type="submit" disabled={create.isPending}>Enregistrer le mandat</Button>
          </form>
        </Panel>
      )}
    </div>
  );
}

function HistoryTab({ property }: { property: Property }) {
  const changes = property.status_changes ?? [];
  return (
    <Panel title="Historique des statuts">
      {!changes.length ? <EmptyState compact>Aucun changement de statut pour l'instant.</EmptyState> : (
        <ol className="relative ml-2 border-l">
          {changes.map((c, i) => (
            <li key={i} className="mb-5 ml-5 last:mb-0">
              <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
              <div className="flex flex-wrap items-center gap-2 text-sm">{c.from && <StatusBadge option={c.from} />}<span className="text-muted-foreground">→</span><StatusBadge option={c.to} /></div>
              <p className="mt-1 text-xs text-muted-foreground">{c.user} · {formatDateTime(c.at)}</p>
              {c.reason && <p className="mt-1 text-sm">« {c.reason} »</p>}
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
