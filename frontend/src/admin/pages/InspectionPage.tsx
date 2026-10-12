import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, CheckCircle2, Download, Lock, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, downloadFile } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApiMutation, useOptions } from "../hooks";
import type { InspectionItem, LeaseInspection, Option } from "../types";
import { EmptyState, Field, FormError, LoadingBlock, Panel, ProgressBar, StatusBadge } from "../components/ui";
import { ProtectedImage } from "../components/ProtectedImage";

/** États du meilleur au pire, avec un libellé court pour les boutons (même ordre que App\Enums\ItemCondition). */
const conditionStyles: Record<string, { short: string; active: string }> = {
  neuf: { short: "Neuf", active: "border-emerald-600 bg-emerald-600 text-white" },
  bon: { short: "Bon", active: "border-green-600 bg-green-600 text-white" },
  usage: { short: "Usure", active: "border-amber-500 bg-amber-500 text-white" },
  mauvais: { short: "Dégradé", active: "border-orange-600 bg-orange-600 text-white" },
  hors_service: { short: "H.S.", active: "border-red-600 bg-red-600 text-white" },
};
const rank = (value: string | undefined) => (value ? Object.keys(conditionStyles).indexOf(value) : -1);

/** Même règle que le serveur : pire qu'à l'entrée et au-delà de l'usure normale. */
function isDegraded(item: InspectionItem): boolean {
  const exit = rank(item.condition?.value);
  return exit > rank("usage") && (!item.entry_condition || exit > rank(item.entry_condition.value));
}

type Draft = Pick<LeaseInspection, "inspected_on" | "electricity_meter" | "water_meter" | "keys_count" | "tenant_present" | "general_comment">;
type DraftItem = InspectionItem & { key: string };

let nextKey = 0;
const withKey = (item: InspectionItem): DraftItem => ({ ...item, key: item.id ? `i${item.id}` : `n${nextKey++}` });

export default function InspectionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const conditions = useOptions("item_conditions");
  const { data: inspection, isLoading, isError } = useQuery({
    queryKey: ["inspection", id],
    queryFn: () => api<{ data: LeaseInspection }>(`/inspections/${id}`).then((r) => r.data),
  });

  const [draft, setDraft] = useState<Draft | null>(null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reprend les données du serveur tant que rien n'est en cours de saisie.
  useEffect(() => {
    if (!inspection || dirty) return;
    setDraft({
      inspected_on: inspection.inspected_on, electricity_meter: inspection.electricity_meter, water_meter: inspection.water_meter,
      keys_count: inspection.keys_count, tenant_present: inspection.tenant_present, general_comment: inspection.general_comment,
    });
    setItems(inspection.items.map(withKey));
  }, [inspection, dirty]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["inspection", id] });
    if (inspection) queryClient.invalidateQueries({ queryKey: ["lease", String(inspection.lease.id)] });
  };
  const save = useApiMutation(
    () => api<{ data: LeaseInspection }>(`/inspections/${id}`, {
      method: "PUT",
      body: {
        ...draft,
        keys_count: draft?.keys_count ?? null,
        items: items.map((i) => ({ id: i.id, room: i.room, element: i.element, condition: i.condition?.value ?? null, comment: i.comment || null })),
      },
    }),
    { onSuccess: (r) => { queryClient.setQueryData(["inspection", id], r.data); setDirty(false); invalidate(); } },
  );
  const validate = useApiMutation(() => api(`/inspections/${id}/validate`, { method: "POST" }), {
    success: "État des lieux validé : il ne se modifie plus.",
    onSuccess: () => { setConfirming(false); setDirty(false); invalidate(); },
  });
  const remove = useApiMutation(() => api(`/inspections/${id}`, { method: "DELETE" }), {
    success: "État des lieux supprimé.",
    onSuccess: () => { if (inspection) { queryClient.invalidateQueries({ queryKey: ["lease", String(inspection.lease.id)] }); navigate(`/admin/baux/${inspection.lease.id}`); } },
  });

  const rooms = useMemo(() => {
    const groups = new Map<string, DraftItem[]>();
    items.forEach((item) => groups.set(item.room, [...(groups.get(item.room) ?? []), item]));
    return [...groups.entries()];
  }, [items]);

  if (isLoading) return <LoadingBlock />;
  if (isError || !inspection || !draft) return <EmptyState title="État des lieux introuvable" action={<Button asChild variant="outline"><Link to="/admin/baux">Retour aux baux</Link></Button>} />;

  const editable = !!inspection.can?.update;
  const exit = inspection.type.value === "sortie";
  const rated = items.filter((i) => i.condition).length;
  const degraded = exit ? items.filter(isDegraded).length : 0;

  const change = (patch: Partial<Draft>) => { setDraft({ ...draft, ...patch }); setDirty(true); };
  const changeItem = (key: string, patch: Partial<InspectionItem>) => { setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i))); setDirty(true); };
  const removeItem = (key: string) => { setItems((list) => list.filter((i) => i.key !== key)); setDirty(true); };
  const addItem = (room: string, element: string) => {
    setItems((list) => {
      const last = list.map((i) => i.room).lastIndexOf(room);
      const item = withKey({ room, element, condition: null, comment: null });
      return last < 0 ? [...list, item] : [...list.slice(0, last + 1), item, ...list.slice(last + 1)];
    });
    setDirty(true);
  };
  const askValidation = async () => {
    if (dirty) {
      try { await save.mutateAsync(undefined); } catch { return; }
    }
    setConfirming(true);
  };

  return (
    <div className={cn(dirty && "pb-24")}>
      <Link to={`/admin/baux/${inspection.lease.id}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Bail {inspection.lease.reference}</Link>

      <section className="mb-6 rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{inspection.type.label}</h1>
              {inspection.validated_at
                ? <StatusBadge option={{ value: "payee", label: "Validé" }} />
                : <StatusBadge option={{ value: "brouillon", label: "En cours" }} />}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              <Link className="font-medium text-foreground hover:underline" to={`/admin/biens/${inspection.lease.property.id}`}>{inspection.lease.property.title}</Link>
              {" · "}{inspection.lease.tenant.name}
            </p>
            {inspection.validated_at && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><Lock className="h-3.5 w-3.5" /> Validé le {formatDateTime(inspection.validated_at)}{inspection.validator && ` par ${inspection.validator.name}`}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => downloadFile(`/inspections/${inspection.id}/pdf`, `etat-des-lieux-${inspection.type.value}-${inspection.lease.reference}.pdf`)}>
              <Download className="h-4 w-4" /> PDF à signer
            </Button>
            {editable && (
              <>
                <Button onClick={askValidation} disabled={save.isPending || validate.isPending}><CheckCircle2 className="h-4 w-4" /> Valider</Button>
                <Button variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => setDeleting(true)}><Trash2 className="h-4 w-4" /></Button>
              </>
            )}
          </div>
        </div>
        <ProgressBar className="mt-4" value={rated} total={items.length} label={`${rated}/${items.length} éléments notés`} />
        {exit && degraded > 0 && <p className="mt-2 text-sm font-medium text-orange-700">{degraded} élément{degraded > 1 ? "s" : ""} dégradé{degraded > 1 ? "s" : ""} par rapport à l'entrée : à retenir sur la caution si besoin.</p>}
        <FormError message={save.error?.field("inspection") ?? save.error?.field("items") ?? validate.error?.field("items") ?? validate.error?.field("inspection")} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          {rooms.map(([room, roomItems]) => (
            <Panel key={room} title={room} bodyClassName="divide-y p-0">
              {roomItems.map((item) => (
                <ItemRow key={item.key} item={item} editable={editable} exit={exit} conditions={conditions}
                  photos={inspection.photos.filter((p) => item.id && p.item_id === item.id)}
                  inspectionId={inspection.id} onUploaded={invalidate}
                  onChange={(patch) => changeItem(item.key, patch)} onRemove={() => removeItem(item.key)} />
              ))}
              {editable && <AddElement onAdd={(element) => addItem(room, element)} />}
            </Panel>
          ))}
          {editable && <AddRoom onAdd={(room, element) => addItem(room, element)} />}
        </div>

        <aside className="space-y-4">
          <Panel title="Relevés">
            <div className="space-y-3">
              <Field label="Date" htmlFor="insp-date" error={save.error?.field("inspected_on")}>
                <Input id="insp-date" type="date" disabled={!editable} value={draft.inspected_on} onChange={(e) => change({ inspected_on: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Compteur électricité" htmlFor="insp-elec" error={save.error?.field("electricity_meter")}>
                  <Input id="insp-elec" inputMode="numeric" disabled={!editable} value={draft.electricity_meter ?? ""} onChange={(e) => change({ electricity_meter: e.target.value || null })} placeholder="Index" />
                </Field>
                <Field label="Compteur eau" htmlFor="insp-water" error={save.error?.field("water_meter")}>
                  <Input id="insp-water" inputMode="numeric" disabled={!editable} value={draft.water_meter ?? ""} onChange={(e) => change({ water_meter: e.target.value || null })} placeholder="Index" />
                </Field>
              </div>
              <Field label="Clés remises" htmlFor="insp-keys" error={save.error?.field("keys_count")}>
                <Input id="insp-keys" type="number" min={0} disabled={!editable} value={draft.keys_count ?? ""} onChange={(e) => change({ keys_count: e.target.value === "" ? null : Number(e.target.value) })} />
              </Field>
              <label className="flex items-center justify-between gap-4 rounded-lg border px-3 py-2.5">
                <span className="text-sm font-medium">Locataire présent</span>
                <Switch disabled={!editable} checked={draft.tenant_present} onCheckedChange={(tenant_present) => change({ tenant_present })} />
              </label>
              <Field label="Observations générales" htmlFor="insp-comment">
                <Textarea id="insp-comment" rows={3} disabled={!editable} value={draft.general_comment ?? ""} onChange={(e) => change({ general_comment: e.target.value || null })} />
              </Field>
              {inspection.inspector && <p className="text-xs text-muted-foreground">Fait par {inspection.inspector.name}, le {formatDate(inspection.inspected_on)}.</p>}
            </div>
          </Panel>
          <Panel title="Photos générales" description="Façade, compteurs, vue d'ensemble.">
            <PhotoStrip inspectionId={inspection.id} photos={inspection.photos.filter((p) => !p.item_id)} editable={editable} onUploaded={invalidate} />
          </Panel>
        </aside>
      </div>

      {dirty && editable && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t bg-card/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur lg:bottom-0 lg:left-64">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Modifications non enregistrées</p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setDirty(false)}>Annuler</Button>
              <Button onClick={() => save.mutate(undefined, { onSuccess: () => toast.success("Enregistré.") })} disabled={save.isPending}>Enregistrer</Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Valider l'état des lieux ?</DialogTitle>
            <DialogDescription>Une fois validé, il ne pourra plus être modifié. Imprimez le PDF et faites-le signer par le locataire.</DialogDescription>
          </DialogHeader>
          <FormError message={validate.error?.field("items") ?? validate.error?.field("inspection")} />
          {rated < items.length && <p className="text-sm text-amber-700">{items.length - rated} élément(s) n'ont pas encore d'état.</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(false)}>Revenir</Button>
            <Button onClick={() => validate.mutate(undefined)} disabled={validate.isPending}>Valider</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer cet état des lieux ?</DialogTitle>
            <DialogDescription>Les lignes et les photos sont supprimées. Possible seulement tant qu'il n'est pas validé.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(false)}>Annuler</Button>
            <Button variant="destructive" onClick={() => remove.mutate(undefined)} disabled={remove.isPending}>Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ItemRow({ item, editable, exit, conditions, photos, inspectionId, onUploaded, onChange, onRemove }: {
  item: DraftItem; editable: boolean; exit: boolean; conditions: Option[];
  photos: LeaseInspection["photos"]; inspectionId: number; onUploaded: () => void;
  onChange: (patch: Partial<InspectionItem>) => void; onRemove: () => void;
}) {
  const degraded = exit && isDegraded(item);
  return (
    <div className={cn("space-y-2 px-4 py-3 sm:px-5", degraded && "bg-orange-50/60")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{item.element}</p>
          {exit && (
            <p className="text-xs text-muted-foreground">
              À l'entrée : {item.entry_condition?.label ?? "non relevé"}{item.entry_comment ? ` — ${item.entry_comment}` : ""}
              {degraded && <span className="ml-1.5 font-medium text-orange-700">· dégradé</span>}
            </p>
          )}
        </div>
        {editable && (
          <button type="button" onClick={onRemove} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label={`Retirer ${item.element}`}><X className="h-4 w-4" /></button>
        )}
      </div>
      {editable ? (
        <div className="grid grid-cols-5 gap-1.5">
          {conditions.map((c) => {
            const style = conditionStyles[c.value];
            const active = item.condition?.value === c.value;
            return (
              <button key={c.value} type="button" title={c.label} aria-pressed={active}
                onClick={() => onChange({ condition: active ? null : c })}
                className={cn("rounded-md border px-1 py-2 text-xs font-medium transition", active ? style?.active : "bg-background hover:bg-muted")}>
                {style?.short ?? c.label}
              </button>
            );
          })}
        </div>
      ) : (
        <p className={cn("text-sm", degraded ? "font-medium text-orange-700" : "text-foreground")}>{item.condition?.label ?? "—"}</p>
      )}
      {editable ? (
        <Input value={item.comment ?? ""} onChange={(e) => onChange({ comment: e.target.value })} placeholder="Observation (facultatif)" className="h-9 text-sm" />
      ) : item.comment && <p className="text-sm text-muted-foreground">{item.comment}</p>}
      {item.id ? (
        <PhotoStrip inspectionId={inspectionId} itemId={item.id} photos={photos} editable={editable} onUploaded={onUploaded} compact />
      ) : editable && <p className="text-xs text-muted-foreground">Enregistrez pour ajouter des photos à cet élément.</p>}
    </div>
  );
}

function PhotoStrip({ inspectionId, itemId, photos, editable, onUploaded, compact }: {
  inspectionId: number; itemId?: number; photos: LeaseInspection["photos"]; editable: boolean; onUploaded: () => void; compact?: boolean;
}) {
  const [uploading, setUploading] = useState(0);
  const [open, setOpen] = useState<LeaseInspection["photos"][number] | null>(null);

  const upload = async (fileList: FileList | null) => {
    // Copie immédiate : la liste du champ est vidée juste après l'appel.
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    for (const file of files) {
      setUploading((n) => n + 1);
      const body = new FormData();
      body.append("photo", file);
      if (itemId) body.append("item_id", String(itemId));
      try {
        await api(`/inspections/${inspectionId}/photos`, { method: "POST", body });
      } catch (error) {
        toast.error(error instanceof ApiError ? (error.field("photo") ?? error.field("inspection") ?? error.message) : "Envoi impossible.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
    onUploaded();
  };

  if (!editable && !photos.length) return compact ? null : <p className="text-sm text-muted-foreground">Aucune photo.</p>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {photos.map((photo) => (
        <button key={photo.id} type="button" onClick={() => setOpen(photo)} className="overflow-hidden rounded-md border">
          <ProtectedImage url={photo.url} className={compact ? "h-14 w-14" : "h-20 w-20"} />
        </button>
      ))}
      {editable && (
        <label className={cn("flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed text-xs text-muted-foreground hover:bg-muted",
          compact ? "h-14 px-3" : "h-20 w-20 flex-col")}>
          <Camera className="h-4 w-4" />{uploading ? "Envoi…" : "Photo"}
          <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
        </label>
      )}
      {open && <PhotoDialog inspectionId={inspectionId} photo={open} editable={editable} onClose={() => setOpen(null)} onDeleted={onUploaded} />}
    </div>
  );
}

function PhotoDialog({ inspectionId, photo, editable, onClose, onDeleted }: {
  inspectionId: number; photo: LeaseInspection["photos"][number]; editable: boolean; onClose: () => void; onDeleted: () => void;
}) {
  const remove = useApiMutation(() => api(`/inspections/${inspectionId}/photos/${photo.id}`, { method: "DELETE" }), {
    success: "Photo supprimée.", onSuccess: () => { onDeleted(); onClose(); },
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Photo</DialogTitle></DialogHeader>
        <ProtectedImage url={photo.url} className="max-h-[70vh] w-full rounded-md object-contain" />
        {editable && (
          <DialogFooter>
            <Button variant="ghost" className="text-destructive" onClick={() => remove.mutate(undefined)} disabled={remove.isPending}><Trash2 className="h-4 w-4" /> Supprimer</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AddElement({ onAdd }: { onAdd: (element: string) => void }) {
  const [value, setValue] = useState("");
  const submit = () => { if (value.trim()) { onAdd(value.trim()); setValue(""); } };
  return (
    <div className="flex gap-2 px-4 py-3 sm:px-5">
      <Input value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
        placeholder="Ajouter un élément (ex. Ventilateur)" className="h-9 text-sm" />
      <Button type="button" variant="outline" size="sm" onClick={submit} disabled={!value.trim()}><Plus className="h-4 w-4" /></Button>
    </div>
  );
}

function AddRoom({ onAdd }: { onAdd: (room: string, element: string) => void }) {
  const [room, setRoom] = useState("");
  const [element, setElement] = useState("Murs et peinture");
  return (
    <Panel title="Ajouter une pièce">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Pièce (ex. Bureau, Garage)" />
        <Input value={element} onChange={(e) => setElement(e.target.value)} placeholder="Premier élément" />
        <Button type="button" variant="outline" disabled={!room.trim() || !element.trim()} onClick={() => { onAdd(room.trim(), element.trim()); setRoom(""); }}>
          <Plus className="h-4 w-4" /> Ajouter
        </Button>
      </div>
    </Panel>
  );
}
