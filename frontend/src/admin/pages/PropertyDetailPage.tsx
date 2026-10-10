import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Archive, ArrowDown, ArrowLeft, ArrowUp, Download, ExternalLink, Star, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, downloadFile } from "@/lib/api";
import { formatDate, formatDateTime, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApiMutation, useOptions } from "../hooks";
import type { DocumentItem, Mandate, Property, PropertyCheck } from "../types";
import { PropertyForm } from "../components/PropertyForm";
import { EmptyState, Field, FormError, LoadingBlock, StatusBadge } from "../components/ui";

export default function PropertyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const key = ["property", id];
  const { data: property, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api<{ data: Property }>(`/properties/${id}`).then((r) => r.data),
  });
  const [statusOpen, setStatusOpen] = useState(false);

  const archive = useApiMutation(() => api(`/properties/${id}`, { method: "DELETE" }), {
    success: "Bien archivé.",
    invalidate: [["properties"]],
    onSuccess: () => navigate("/admin/biens"),
  });

  if (isLoading || !property) return <LoadingBlock />;

  const checks = property.checks ?? [];
  const cleared = checks.filter((c) => c.is_cleared).length;
  const isPublic = ["disponible", "en_negociation"].includes(property.status.value);

  return (
    <>
      <Link to="/admin/biens" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Biens
      </Link>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{property.reference}</span>
            <StatusBadge option={property.status} />
          </div>
          <h1 className="mt-1 font-display text-2xl font-bold md:text-3xl">{property.title}</h1>
          <p className="text-muted-foreground">
            {[property.neighborhood, property.city].filter(Boolean).join(", ")} · {property.type.label} ·{" "}
            <span className="font-semibold text-accent">{formatPrice(property.price, property.transaction.value === "location")}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isPublic && (
            <Button asChild variant="outline">
              <a href={`/biens/${property.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Voir sur le site</a>
            </Button>
          )}
          {property.can.update && (
            <>
              <Button variant="gold" onClick={() => setStatusOpen(true)}>Changer le statut</Button>
              <Button variant="outline" onClick={() => confirm("Archiver ce bien ? Il disparaîtra des listes et du site.") && archive.mutate(undefined)}>
                <Archive className="h-4 w-4" /> Archiver
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs defaultValue="verification">
        <TabsList className="mb-4 flex h-auto flex-wrap justify-start">
          <TabsTrigger value="verification">Vérification foncière ({cleared}/{checks.length})</TabsTrigger>
          <TabsTrigger value="photos">Photos ({property.photos?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="fiche">Fiche</TabsTrigger>
          {property.can.view_documents && <TabsTrigger value="documents">Pièces</TabsTrigger>}
          {property.can.view_documents && <TabsTrigger value="mandats">Mandats</TabsTrigger>}
          <TabsTrigger value="historique">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="verification">
          <p className="mb-4 text-sm text-muted-foreground">
            Chaque point doit être « Vérifié » ou « Sans objet » (avec une note) pour publier le bien. L'état des droits réels doit dater de moins de 90 jours.
          </p>
          <div className="space-y-3">
            {checks.map((check) => <CheckRow key={check.id} propertyId={property.id} check={check} editable={property.can.update} />)}
          </div>
        </TabsContent>

        <TabsContent value="photos"><PhotosTab property={property} /></TabsContent>

        <TabsContent value="fiche">
          <Card><CardContent className="pt-6">
            {property.can.update ? <EditForm property={property} /> : <ReadOnlySheet property={property} />}
          </CardContent></Card>
        </TabsContent>

        {property.can.view_documents && <TabsContent value="documents"><DocumentsTab property={property} /></TabsContent>}
        {property.can.view_documents && <TabsContent value="mandats"><MandatesTab property={property} /></TabsContent>}

        <TabsContent value="historique">
          {!property.status_changes?.length ? <EmptyState>Aucun changement de statut.</EmptyState> : (
            <Card className="divide-y">
              {property.status_changes.map((c, i) => (
                <div key={i} className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                  <span className="flex items-center gap-2">
                    {c.from && <StatusBadge option={c.from} />} → <StatusBadge option={c.to} />
                    {c.reason && <span className="text-muted-foreground">« {c.reason} »</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">{c.user} · {formatDateTime(c.at)}</span>
                </div>
              ))}
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <StatusDialog property={property} open={statusOpen} onOpenChange={setStatusOpen} />
    </>
  );
}

function CheckRow({ propertyId, check, editable }: { propertyId: number; check: PropertyCheck; editable: boolean }) {
  const statuses = useOptions("check_statuses");
  const [status, setStatus] = useState(check.status.value);
  const [note, setNote] = useState(check.note ?? "");
  const dirty = status !== check.status.value || note !== (check.note ?? "");

  const save = useApiMutation(
    () => api(`/properties/${propertyId}/checks/${check.id}`, { method: "PUT", body: { status, note: note || null } }),
    { success: "Point de vérification enregistré.", invalidate: [["property", String(propertyId)]] },
  );

  return (
    <Card className={cn("p-4", check.is_cleared ? "border-emerald-200" : check.status.value === "ko" || check.is_expired ? "border-red-300" : "")}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start">
        <div className="flex-1">
          <p className="font-medium">{check.item.label}</p>
          <p className="text-xs text-muted-foreground">
            {check.checked_by ? `${check.checked_by}, ${formatDate(check.checked_at)}` : "Pas encore vérifié"}
            {check.is_expired && <span className="ml-2 font-medium text-red-600">À renouveler</span>}
          </p>
        </div>
        {editable ? (
          <div className="flex flex-1 flex-col gap-2 md:max-w-md">
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
            <Textarea rows={2} placeholder="Note (obligatoire pour « Problème » ou « Sans objet »)" value={note} onChange={(e) => setNote(e.target.value)} />
            {save.error?.field("note") && <p className="text-xs text-destructive">{save.error.field("note")}</p>}
            {dirty && <Button size="sm" variant="gold" className="self-end" disabled={save.isPending} onClick={() => save.mutate(undefined)}>Enregistrer</Button>}
          </div>
        ) : (
          <div className="flex flex-col items-end gap-1">
            <StatusBadge option={check.status} />
            {check.note && <p className="text-xs text-muted-foreground">{check.note}</p>}
          </div>
        )}
      </div>
    </Card>
  );
}

function StatusDialog({ property, open, onOpenChange }: { property: Property; open: boolean; onOpenChange: (o: boolean) => void }) {
  const statuses = useOptions("property_statuses").filter((s) => s.value !== property.status.value && s.value !== "brouillon");
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");

  const mutation = useApiMutation(
    () => api(`/properties/${property.id}/status`, { method: "POST", body: { status, reason: reason || null } }),
    {
      success: "Statut mis à jour.",
      invalidate: [["property", String(property.id)], ["properties"]],
      onSuccess: () => { setStatus(""); setReason(""); onOpenChange(false); },
    },
  );

  const submit = (e: FormEvent) => { e.preventDefault(); mutation.mutate(undefined); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Changer le statut</DialogTitle>
          <DialogDescription>Statut actuel : {property.status.label}. « Disponible » publie le bien sur le site.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nouveau statut" htmlFor="status">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status"><SelectValue placeholder="Choisir" /></SelectTrigger>
              <SelectContent>{statuses.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Motif" htmlFor="reason" error={mutation.error?.field("reason")} hint="Obligatoire pour retirer un bien.">
            <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <FormError message={mutation.error?.field("status")} />
          <DialogFooter>
            <Button type="submit" variant="gold" disabled={!status || mutation.isPending}>Valider</Button>
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

function ReadOnlySheet({ property }: { property: Property }) {
  const rows: [string, string | number | null][] = [
    ["Surface", property.surface ? `${property.surface} m²` : null],
    ["Terrain", property.land_surface ? `${property.land_surface} m²` : null],
    ["Pièces", property.rooms],
    ["Chambres", property.bedrooms],
    ["Situation juridique", property.land_status.label],
    ["Équipements", property.features.join(", ")],
  ];
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.filter(([, v]) => v !== null && v !== "").map(([k, v]) => (
        <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd>{v}</dd></div>
      ))}
      <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Description</dt><dd className="whitespace-pre-line">{property.description}</dd></div>
    </dl>
  );
}

function PhotosTab({ property }: { property: Property }) {
  const photos = property.photos ?? [];
  const invalidate = [["property", String(property.id)], ["properties"]];

  const upload = useApiMutation(
    (files: FileList) => {
      const body = new FormData();
      Array.from(files).forEach((f) => body.append("photos[]", f));
      return api(`/properties/${property.id}/photos`, { method: "POST", body });
    },
    { success: "Photos ajoutées.", invalidate },
  );
  const cover = useApiMutation((photoId: number) => api(`/properties/${property.id}/photos/${photoId}/cover`, { method: "PUT" }), { invalidate });
  const remove = useApiMutation((photoId: number) => api(`/properties/${property.id}/photos/${photoId}`, { method: "DELETE" }), { invalidate });
  const reorder = useApiMutation((ids: number[]) => api(`/properties/${property.id}/photos/order`, { method: "PUT", body: { ids } }), { invalidate });

  const move = (index: number, delta: number) => {
    const ids = photos.map((p) => p.id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    reorder.mutate(ids);
  };

  return (
    <div className="space-y-4">
      {property.can.update && (
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="gold" disabled={upload.isPending}>
            <label className="cursor-pointer">
              <Upload className="h-4 w-4" /> {upload.isPending ? "Envoi…" : "Ajouter des photos"}
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
                onChange={(e) => e.target.files?.length && upload.mutate(e.target.files)} />
            </label>
          </Button>
          <span className="text-xs text-muted-foreground">20 photos maximum. Elles sont allégées automatiquement pour le site.</span>
        </div>
      )}
      {upload.error && <FormError message={upload.error.field("photos") ?? upload.error.message} />}
      {!photos.length ? <EmptyState>Aucune photo.</EmptyState> : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {photos.map((photo, index) => (
            <div key={photo.id} className={cn("group relative overflow-hidden rounded-lg border", photo.is_cover && "ring-2 ring-accent")}>
              <img src={photo.url} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" />
              {photo.is_cover && <span className="absolute left-2 top-2 rounded bg-accent px-2 py-0.5 text-xs text-accent-foreground">Principale</span>}
              {property.can.update && (
                <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 bg-black/50 p-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-white" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Avancer"><ArrowUp className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-white" disabled={index === photos.length - 1} onClick={() => move(index, 1)} aria-label="Reculer"><ArrowDown className="h-4 w-4" /></Button>
                  {!photo.is_cover && <Button size="icon" variant="ghost" className="h-8 w-8 text-white" onClick={() => cover.mutate(photo.id)} aria-label="Photo principale"><Star className="h-4 w-4" /></Button>}
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-white" onClick={() => confirm("Supprimer cette photo ?") && remove.mutate(photo.id)} aria-label="Supprimer"><Trash2 className="h-4 w-4" /></Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentsTab({ property }: { property: Property }) {
  const types = useOptions("property_document_types");
  const [type, setType] = useState("titre_foncier");
  const key = ["property-documents", property.id];
  const { data } = useQuery({ queryKey: key, queryFn: () => api<{ data: DocumentItem[] }>(`/properties/${property.id}/documents`).then((r) => r.data) });

  const upload = useApiMutation(
    (file: File) => {
      const body = new FormData();
      body.append("type", type);
      body.append("document", file);
      return api(`/properties/${property.id}/documents`, { method: "POST", body });
    },
    { success: "Pièce ajoutée.", invalidate: [key] },
  );
  const remove = useApiMutation((docId: number) => api(`/properties/${property.id}/documents/${docId}`, { method: "DELETE" }), { invalidate: [key] });

  return (
    <div className="space-y-4">
      {property.can.update && (
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Type de pièce" htmlFor="doc-type">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="doc-type" className="w-72"><SelectValue /></SelectTrigger>
              <SelectContent>{types.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Button asChild variant="gold" disabled={upload.isPending}>
            <label className="cursor-pointer">
              <Upload className="h-4 w-4" /> Envoyer un fichier
              <input type="file" accept="application/pdf,image/jpeg,image/png" className="hidden" onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
            </label>
          </Button>
        </div>
      )}
      {upload.error && <FormError message={upload.error.field("document") ?? upload.error.message} />}
      <p className="text-xs text-muted-foreground">Pièces privées : chaque téléchargement est enregistré dans le journal.</p>
      {!data?.length ? <EmptyState>Aucune pièce.</EmptyState> : (
        <Card className="divide-y">
          {data.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div>
                <p className="font-medium">{doc.original_name}</p>
                <p className="text-xs text-muted-foreground">{doc.type.label} · {formatDate(doc.created_at)}</p>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => downloadFile(`/properties/${property.id}/documents/${doc.id}`, doc.original_name)} aria-label="Télécharger"><Download className="h-4 w-4" /></Button>
                {property.can.update && <Button size="icon" variant="ghost" onClick={() => confirm("Supprimer cette pièce ?") && remove.mutate(doc.id)} aria-label="Supprimer"><Trash2 className="h-4 w-4" /></Button>}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
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
    { success: "Mandat enregistré.", invalidate: [key], onSuccess: () => setForm(empty) },
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-3">
        {!data?.length ? <EmptyState>Aucun mandat.</EmptyState> : data.map((m) => (
          <Card key={m.id} className="p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium">Mandat {m.type.label.toLowerCase()}</span>
              <StatusBadge option={m.status} />
            </div>
            <p className="text-muted-foreground">Du {formatDate(m.starts_on)} au {formatDate(m.ends_on)}</p>
            <p>Commission : {m.commission_type.value === "pourcentage" ? `${m.commission_value} %` : formatPrice(m.commission_value)}</p>
            {m.owner && <p className="text-muted-foreground">Mandant : {m.owner.name}</p>}
          </Card>
        ))}
      </div>
      {property.can.update && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Nouveau mandat</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); create.mutate(undefined); }} className="space-y-3">
              <Field label="Type" htmlFor="m-type">
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger id="m-type"><SelectValue /></SelectTrigger>
                  <SelectContent>{types.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Début" htmlFor="m-start" error={create.error?.field("starts_on")}>
                  <Input id="m-start" type="date" value={form.starts_on} onChange={(e) => setForm({ ...form, starts_on: e.target.value })} required />
                </Field>
                <Field label="Fin" htmlFor="m-end" error={create.error?.field("ends_on")}>
                  <Input id="m-end" type="date" value={form.ends_on} onChange={(e) => setForm({ ...form, ends_on: e.target.value })} required />
                </Field>
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
              <Field label="Conditions" htmlFor="m-cond">
                <Textarea id="m-cond" rows={2} value={form.conditions} onChange={(e) => setForm({ ...form, conditions: e.target.value })} />
              </Field>
              <Button type="submit" variant="gold" disabled={create.isPending}>Enregistrer</Button>
              <p className="text-xs text-muted-foreground">L'agent est prévenu 7 jours avant l'expiration.</p>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
