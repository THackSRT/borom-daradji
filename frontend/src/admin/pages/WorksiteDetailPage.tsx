import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, Copy, Eye, EyeOff, Link2, MapPin, Pencil, Phone, RefreshCw, Trash2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import { currentPosition } from "@/lib/geo";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApiMutation } from "../hooks";
import type { Ref, Worksite } from "../types";
import { cfa, MoneyInput } from "../components/billing";
import { EmptyState, Field, FormError, LoadingBlock, Panel, ProgressBar, StatusBadge, WhatsAppLink } from "../components/ui";
import { ProtectedImage } from "../components/ProtectedImage";

export default function WorksiteDetailPage() {
  const { id } = useParams();
  const [editing, setEditing] = useState(false);
  const { data: worksite, isLoading, isError } = useQuery({
    queryKey: ["worksite", id],
    queryFn: () => api<{ data: Worksite }>(`/worksites/${id}`).then((r) => r.data),
  });
  const transition = useApiMutation((status: string) => api(`/worksites/${id}/status`, { method: "POST", body: { status } }), {
    success: "Statut mis à jour.", invalidate: [["worksite", id], ["worksites"]],
  });

  if (isLoading) return <LoadingBlock />;
  if (isError || !worksite) return <EmptyState title="Chantier introuvable" action={<Button asChild variant="outline"><Link to="/admin/chantiers">Retour aux chantiers</Link></Button>} />;

  const canUpdate = !!worksite.can?.update;
  const transitionLabels: Record<string, string> = { planifie: "Planifier", en_cours: worksite.status.value === "planifie" ? "Démarrer" : "Reprendre", suspendu: "Suspendre", termine: "Terminer", facture: "Marquer facturé" };

  return (
    <>
      <Link to="/admin/chantiers" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Chantiers</Link>

      <section className="mb-6 rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{worksite.title}</h1>
              <StatusBadge option={worksite.status} />
              {worksite.is_late && <StatusBadge option={{ value: "en_retard", label: "En retard" }} />}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              <span className="font-mono">{worksite.reference}</span> ·{" "}
              <Link className="font-medium text-foreground hover:underline" to={`/admin/clients/${worksite.client.id}`}>{worksite.client.name}</Link>
              {worksite.quote && <> · devis <Link className="hover:underline" to={`/admin/devis/${worksite.quote.id}`}>{worksite.quote.number}</Link></>}
            </p>
            {worksite.address && (
              <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {worksite.latitude && worksite.longitude
                  ? <a className="hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${worksite.latitude},${worksite.longitude}`}>{worksite.address}</a>
                  : worksite.address}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {worksite.client.phone && <Button asChild variant="outline"><a href={`tel:${worksite.client.phone}`}><Phone className="h-4 w-4" /> Client</a></Button>}
            {canUpdate && worksite.allowed_transitions.map((t) => (
              <Button key={t.value} variant={t.value === "en_cours" || t.value === "termine" ? "default" : "outline"} disabled={transition.isPending} onClick={() => transition.mutate(t.value)}>
                {transitionLabels[t.value] ?? t.label}
              </Button>
            ))}
            {canUpdate && <Button variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Modifier</Button>}
          </div>
        </div>
        <FormError message={transition.error?.field("status")} />
        <div className="mt-4 grid gap-4 border-t pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Avancement"><ProgressBar value={worksite.progress ?? 0} total={100} label={`${worksite.progress ?? 0} %`} /></Info>
          <Info label="Chef de chantier">{worksite.manager?.name ?? <span className="text-muted-foreground">À désigner</span>}</Info>
          <Info label="Dates">{worksite.start_date ? `Début ${formatDate(worksite.start_date)}` : "Pas commencé"}{worksite.planned_end_date && <span className={cn("block text-xs", worksite.is_late ? "font-medium text-red-600" : "text-muted-foreground")}>Fin prévue {formatDate(worksite.planned_end_date)}</span>}</Info>
          <Info label="Montant du marché">{cfa(worksite.contract_total)} <span className="text-xs text-muted-foreground">TTC</span></Info>
        </div>
      </section>

      <Tabs defaultValue="avancement">
        <TabsList className="mb-4 flex h-auto flex-wrap justify-start">
          <TabsTrigger value="avancement">Avancement</TabsTrigger>
          <TabsTrigger value="journal">Journal</TabsTrigger>
          <TabsTrigger value="photos">Photos ({worksite.photos?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="suivi">Lien de suivi</TabsTrigger>
        </TabsList>
        <TabsContent value="avancement"><ProgressTab worksite={worksite} /></TabsContent>
        <TabsContent value="journal"><LogTab worksite={worksite} /></TabsContent>
        <TabsContent value="photos"><PhotosTab worksite={worksite} /></TabsContent>
        <TabsContent value="suivi"><TrackingTab worksite={worksite} /></TabsContent>
      </Tabs>

      {editing && <EditWorksiteDialog worksite={worksite} onClose={() => setEditing(false)} />}
    </>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><div className="mt-0.5 font-medium">{children}</div></div>;
}

function ProgressTab({ worksite }: { worksite: Worksite }) {
  const id = String(worksite.id);
  const editable = !!worksite.can?.update && ["planifie", "en_cours", "suspendu"].includes(worksite.status.value);
  const mutation = useApiMutation(({ lot, progress }: { lot: number; progress: number }) => api(`/worksites/${id}/lots/${lot}/progress`, { method: "PUT", body: { progress } }), {
    invalidate: [["worksite", id], ["worksites"]],
  });
  if (!worksite.lots?.length) {
    return <Panel><p className="text-sm text-muted-foreground">Pas encore de lots : ils viennent du devis accepté.</p></Panel>;
  }
  return (
    <Panel title="Avancement par lot" description={editable ? "Choisissez le pourcentage réalisé : il s'inscrit au journal et apparaît sur le lien de suivi du client." : undefined} bodyClassName="divide-y p-0">
      {worksite.lots.map((lot) => (
        <div key={lot.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{lot.title}</p>
            <p className="text-xs text-muted-foreground">{cfa(lot.amount_ht)} HT</p>
          </div>
          <div className="flex items-center gap-3 sm:w-80">
            <ProgressBar className="flex-1" value={lot.progress} total={100} label={`${lot.progress} %`} />
            {editable && (
              <Select value={String(lot.progress)} onValueChange={(v) => mutation.mutate({ lot: lot.id, progress: Number(v) })}>
                <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                <SelectContent>{[0, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100].map((p) => <SelectItem key={p} value={String(p)}>{p} %</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
        </div>
      ))}
    </Panel>
  );
}

function LogTab({ worksite }: { worksite: Worksite }) {
  const id = String(worksite.id);
  const [body, setBody] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const add = useApiMutation(() => api(`/worksites/${id}/logs`, { method: "POST", body: { body, is_public: isPublic } }), {
    success: "Ajouté au journal.", invalidate: [["worksite", id]], onSuccess: () => { setBody(""); setIsPublic(false); },
  });
  const remove = useApiMutation((logId: number) => api(`/worksites/${id}/logs/${logId}`, { method: "DELETE" }), { invalidate: [["worksite", id]] });
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Panel title="Journal du chantier" bodyClassName="p-0">
        {!worksite.logs?.length ? <p className="p-5 text-sm text-muted-foreground">Rien d'inscrit pour l'instant.</p> : (
          <ol className="divide-y">
            {worksite.logs.map((log) => (
              <li key={log.id} className="flex gap-3 px-5 py-3">
                <div className="w-20 shrink-0 text-xs text-muted-foreground">{formatDate(log.logged_on, "d MMM")}</div>
                <div className="min-w-0 flex-1">
                  <p className={cn("whitespace-pre-line text-sm", log.kind !== "note" && "text-muted-foreground")}>{log.body}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {log.user?.name ?? "Automatique"} · {log.is_public ? <span className="text-emerald-700">visible du client</span> : "interne"}
                  </p>
                </div>
                {log.kind === "note" && worksite.can?.update && (
                  <button type="button" className="self-start rounded p-1 text-muted-foreground hover:text-destructive" onClick={() => remove.mutate(log.id)} aria-label="Supprimer la note"><Trash2 className="h-4 w-4" /></button>
                )}
              </li>
            ))}
          </ol>
        )}
      </Panel>
      {worksite.can?.update && (
        <Panel title="Ajouter une note">
          <div className="space-y-3">
            <Textarea rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Livraison du ciment, réunion avec le client, problème rencontré…" />
            <FormError message={add.error?.field("body")} />
            <label className="flex items-center justify-between gap-3 text-sm"><span>Visible du client (lien de suivi)</span><Switch checked={isPublic} onCheckedChange={setIsPublic} /></label>
            <Button className="w-full" onClick={() => add.mutate(undefined)} disabled={add.isPending || !body.trim()}>Ajouter</Button>
          </div>
        </Panel>
      )}
    </div>
  );
}

function PhotosTab({ worksite }: { worksite: Worksite }) {
  const id = String(worksite.id);
  const queryClient = useQueryClient();
  const [lotId, setLotId] = useState("none");
  const [uploading, setUploading] = useState(0);
  const [open, setOpen] = useState<NonNullable<Worksite["photos"]>[number] | null>(null);
  const photos = worksite.photos ?? [];

  const upload = async (fileList: FileList | null) => {
    // Copie immédiate : la liste du champ est vidée juste après (pour pouvoir reprendre la même photo).
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    const position = await currentPosition();
    for (const file of files) {
      setUploading((n) => n + 1);
      const body = new FormData();
      body.append("photo", file);
      body.append("taken_at", new Date(file.lastModified || Date.now()).toISOString());
      body.append("client_uuid", crypto.randomUUID());
      if (lotId !== "none") body.append("worksite_lot_id", lotId);
      if (position) { body.append("latitude", String(position.latitude)); body.append("longitude", String(position.longitude)); }
      try {
        await api(`/worksites/${id}/photos`, { method: "POST", body });
      } catch (error) {
        toast.error(error instanceof ApiError ? (error.field("photo") ?? error.message) : "Envoi impossible.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
    queryClient.invalidateQueries({ queryKey: ["worksite", id] });
  };

  return (
    <Panel title="Photos du chantier" description="Datées et localisées par le téléphone. Les photos publiques apparaissent sur le lien de suivi du client."
      action={worksite.can?.update && (
        <div className="flex items-center gap-2">
          {!!worksite.lots?.length && (
            <Select value={lotId} onValueChange={setLotId}>
              <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sans lot</SelectItem>
                {worksite.lots.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.title}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button asChild size="sm">
            <label className="cursor-pointer"><Camera className="h-4 w-4" /> {uploading ? "Envoi…" : "Ajouter"}
              <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
            </label>
          </Button>
        </div>
      )}>
      {!photos.length ? <p className="text-sm text-muted-foreground">Aucune photo.</p> : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((p) => (
            <button key={p.id} type="button" onClick={() => setOpen(p)} className="group overflow-hidden rounded-lg border text-left">
              <ProtectedImage url={p.url} className="aspect-[4/3] w-full" />
              <div className="px-2 py-1.5 text-xs">
                <p className="truncate font-medium">{p.caption ?? worksite.lots?.find((l) => l.id === p.lot_id)?.title ?? "Sans légende"}</p>
                <p className="flex items-center gap-1 text-muted-foreground">{formatDateTime(p.taken_at)} {p.latitude && <MapPin className="h-3 w-3" />} {!p.is_public && <EyeOff className="h-3 w-3" />}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      {open && <PhotoDialog worksite={worksite} photo={open} onClose={() => setOpen(null)} />}
    </Panel>
  );
}

function PhotoDialog({ worksite, photo, onClose }: { worksite: Worksite; photo: NonNullable<Worksite["photos"]>[number]; onClose: () => void }) {
  const id = String(worksite.id);
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [isPublic, setIsPublic] = useState(photo.is_public);
  const save = useApiMutation(() => api(`/worksites/${id}/photos/${photo.id}`, { method: "PUT", body: { caption: caption || null, is_public: isPublic } }), {
    success: "Photo mise à jour.", invalidate: [["worksite", id]], onSuccess: onClose,
  });
  const remove = useApiMutation(() => api(`/worksites/${id}/photos/${photo.id}`, { method: "DELETE" }), {
    success: "Photo supprimée.", invalidate: [["worksite", id]], onSuccess: onClose,
  });
  const editable = !!worksite.can?.update;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Photo du {formatDateTime(photo.taken_at)}</DialogTitle>
          {photo.latitude && photo.longitude && (
            <DialogDescription><a className="inline-flex items-center gap-1 hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${photo.latitude},${photo.longitude}`}><MapPin className="h-3.5 w-3.5" /> Voir l'endroit de la prise de vue</a></DialogDescription>
          )}
        </DialogHeader>
        <ProtectedImage url={photo.url} className="max-h-[60vh] w-full rounded-md object-contain" />
        {editable && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Légende" />
            <label className="flex shrink-0 items-center gap-2 text-sm">{isPublic ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />} Visible du client <Switch checked={isPublic} onCheckedChange={setIsPublic} /></label>
          </div>
        )}
        {editable && (
          <DialogFooter>
            <Button variant="ghost" className="text-destructive" onClick={() => remove.mutate(undefined)} disabled={remove.isPending}><Trash2 className="h-4 w-4" /> Supprimer</Button>
            <Button onClick={() => save.mutate(undefined)} disabled={save.isPending}>Enregistrer</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TrackingTab({ worksite }: { worksite: Worksite }) {
  const id = String(worksite.id);
  const enable = useApiMutation(() => api(`/worksites/${id}/tracking`, { method: "POST" }), { success: "Lien de suivi prêt.", invalidate: [["worksite", id]] });
  const revoke = useApiMutation(() => api(`/worksites/${id}/tracking`, { method: "DELETE" }), { success: "Lien désactivé : il ne fonctionne plus.", invalidate: [["worksite", id]] });
  const url = worksite.tracking_token ? `${window.location.origin}/suivi/${worksite.tracking_token}` : null;
  const phone = worksite.client.phone?.replace(/\D/g, "");
  const whatsapp = url && phone ? `https://wa.me/${phone}?text=${encodeURIComponent(`Bonjour ${worksite.client.name}, suivez l'avancement de votre chantier « ${worksite.title} » (photos, étapes, paiements) ici : ${url}`)}` : null;

  return (
    <Panel title="Lien de suivi du client" description="Une adresse privée, en lecture seule : avancement, photos et notes publiques, paiements. Idéal pour un client à l'étranger.">
      {!worksite.can?.update ? <p className="text-sm text-muted-foreground">Réservé aux personnes qui gèrent le chantier.</p> : url ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input readOnly value={url} onFocus={(e) => e.target.select()} />
            <Button variant="outline" onClick={() => navigator.clipboard.writeText(url).then(() => toast.success("Lien copié."))}><Copy className="h-4 w-4" /> Copier</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <WhatsAppLink url={whatsapp} label="Envoyer au client" />
            <Button variant="outline" asChild><a href={url} target="_blank" rel="noreferrer"><Eye className="h-4 w-4" /> Voir comme le client</a></Button>
            <Button variant="ghost" onClick={() => enable.mutate(undefined)}><RefreshCw className="h-4 w-4" /> Nouveau lien</Button>
            <Button variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => revoke.mutate(undefined)}><Unlink className="h-4 w-4" /> Désactiver</Button>
          </div>
          <p className="text-xs text-muted-foreground">« Nouveau lien » rend l'ancien inutilisable (si le lien a circulé par erreur).</p>
        </div>
      ) : (
        <Button onClick={() => enable.mutate(undefined)} disabled={enable.isPending}><Link2 className="h-4 w-4" /> Créer le lien de suivi</Button>
      )}
    </Panel>
  );
}

function EditWorksiteDialog({ worksite, onClose }: { worksite: Worksite; onClose: () => void }) {
  const id = String(worksite.id);
  const { data: team = [] } = useQuery({ queryKey: ["team"], queryFn: () => api<{ data: Ref[] }>("/team").then((r) => r.data) });
  const [form, setForm] = useState({
    title: worksite.title,
    manager_id: worksite.manager?.id ?? null as number | null,
    start_date: worksite.start_date ?? "",
    planned_end_date: worksite.planned_end_date ?? "",
    address: worksite.address ?? "",
    latitude: worksite.latitude,
    longitude: worksite.longitude,
    notes: worksite.notes ?? "",
    budget_materials: (worksite.budget?.materials ?? "") as number | "",
    budget_labor: (worksite.budget?.labor ?? "") as number | "",
    budget_other: (worksite.budget?.other ?? "") as number | "",
  });
  const costs = !!worksite.can?.costs;
  const mutation = useApiMutation(() => api(`/worksites/${id}`, {
    method: "PUT",
    body: {
      title: form.title, manager_id: form.manager_id, start_date: form.start_date || null, planned_end_date: form.planned_end_date || null,
      address: form.address || null, latitude: form.latitude, longitude: form.longitude, notes: form.notes || null,
      ...(costs ? { budget_materials: form.budget_materials || 0, budget_labor: form.budget_labor || 0, budget_other: form.budget_other || 0 } : {}),
    },
  }), { success: "Chantier mis à jour.", invalidate: [["worksite", id], ["worksites"]], onSuccess: onClose });
  const err = (f: string) => mutation.error?.field(f);
  const locate = async () => {
    const p = await currentPosition(10_000);
    if (p) { setForm({ ...form, ...p }); toast.success("Position enregistrée."); } else toast.error("Position indisponible : autorisez la localisation.");
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogHeader><DialogTitle>Modifier le chantier</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Field label="Intitulé" htmlFor="ew-title" error={err("title")}><Input id="ew-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="Chef de chantier" error={err("manager_id")}>
            <Select value={form.manager_id ? String(form.manager_id) : "none"} onValueChange={(v) => setForm({ ...form, manager_id: v === "none" ? null : Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">À désigner</SelectItem>
                {team.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Début" htmlFor="ew-start" error={err("start_date")}><Input id="ew-start" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></Field>
            <Field label="Fin prévue" htmlFor="ew-end" error={err("planned_end_date")}><Input id="ew-end" type="date" value={form.planned_end_date} onChange={(e) => setForm({ ...form, planned_end_date: e.target.value })} /></Field>
          </div>
          <Field label="Adresse" htmlFor="ew-address" error={err("address")}>
            <div className="flex gap-2">
              <Input id="ew-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <Button type="button" variant="outline" onClick={locate} title="Enregistrer ma position actuelle"><MapPin className="h-4 w-4" /></Button>
            </div>
            {form.latitude && form.longitude && <p className="mt-1 text-xs text-muted-foreground">Position : {form.latitude}, {form.longitude}</p>}
          </Field>
          {costs && (
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-medium">Budget de coût prévu</p>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Matériaux" error={err("budget_materials")}><MoneyInput value={form.budget_materials} onChange={(budget_materials) => setForm({ ...form, budget_materials })} /></Field>
                <Field label="Main-d'œuvre" error={err("budget_labor")}><MoneyInput value={form.budget_labor} onChange={(budget_labor) => setForm({ ...form, budget_labor })} /></Field>
                <Field label="Autres" error={err("budget_other")}><MoneyInput value={form.budget_other} onChange={(budget_other) => setForm({ ...form, budget_other })} /></Field>
              </div>
            </div>
          )}
          <Field label="Notes" htmlFor="ew-notes"><Textarea id="ew-notes" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={() => mutation.mutate(undefined)} disabled={mutation.isPending}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
