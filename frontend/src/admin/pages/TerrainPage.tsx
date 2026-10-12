import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, CloudOff, CloudUpload, HardHat, ImagePlus, Loader2, Minus, RefreshCw, Trash2, UserCheck, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/format";
import { currentPosition } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { uuid } from "@/lib/uuid";
import type { Paginated, Worker, Worksite, WorksiteTeam } from "../types";
import { cfa, MoneyInput } from "../components/billing";
import { Field, Panel } from "../components/ui";
import { useAuth } from "../auth";
import { useCachedQuery } from "../offline/cachedQuery";
import { shrinkImage } from "../offline/image";
import { discard, enqueue, useOutbox, type OutboxItem } from "../offline/outbox";

const SITE_KEY = "borom_terrain_site";
const today = () => new Date().toLocaleDateString("en-CA");
const CATEGORIES = [
  { value: "materiaux", label: "Matériaux" },
  { value: "main_oeuvre", label: "Main-d'œuvre" },
  { value: "transport", label: "Transport" },
  { value: "outillage", label: "Outillage" },
  { value: "divers", label: "Divers" },
];

type Mode = "photo" | "pointage" | "depense" | null;

/**
 * Appli terrain du chef de chantier, faite pour le téléphone et le réseau qui coupe : photos, pointage
 * et dépenses sont d'abord gardés sur le téléphone, puis envoyés dès que le réseau revient.
 */
export default function TerrainPage() {
  const { user, can } = useAuth();
  const outbox = useOutbox();
  const [siteId, setSiteId] = useState<number | null>(() => Number(localStorage.getItem(SITE_KEY)) || null);
  const [mode, setMode] = useState<Mode>(null);

  const sites = useCachedQuery("worksites", () => api<Paginated<Worksite>>("/worksites", { query: { state: "ouverts", per_page: 100 } }).then((r) => r.data));
  const list = useMemo(() => {
    const all = sites.data?.value ?? [];
    return [...all].sort((a, b) => Number(b.manager?.id === user?.id) - Number(a.manager?.id === user?.id));
  }, [sites.data, user?.id]);
  const site = list.find((w) => w.id === siteId) ?? null;

  useEffect(() => {
    if (!site && list.length) setSiteId(list[0].id);
  }, [site, list]);
  useEffect(() => {
    try { if (siteId) localStorage.setItem(SITE_KEY, String(siteId)); } catch { /* navigation privée */ }
  }, [siteId]);

  const syncNow = async () => {
    const { sent, left } = await outbox.sync();
    if (sent) toast.success(`${sent} envoi${sent > 1 ? "s" : ""} réussi${sent > 1 ? "s" : ""}.`);
    else if (left && !navigator.onLine) toast.info("Toujours pas de réseau : les saisies restent sur le téléphone.");
  };

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-6">
      <div className={cn("flex items-center justify-between gap-3 rounded-xl border px-4 py-3", outbox.online ? "bg-card" : "border-amber-300 bg-amber-50")}>
        <div className="flex items-center gap-2 text-sm">
          {outbox.online ? <Wifi className="h-4 w-4 text-emerald-600" /> : <CloudOff className="h-4 w-4 text-amber-700" />}
          <span className="font-medium">{outbox.online ? "En ligne" : "Hors ligne"}</span>
          <span className="text-muted-foreground">· {outbox.pending ? `${outbox.pending} en attente` : "tout est envoyé"}</span>
        </div>
        <Button size="sm" variant="outline" disabled={outbox.syncing || !outbox.pending} onClick={syncNow}>
          {outbox.syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />} Envoyer
        </Button>
      </div>

      <section>
        <h1 className="mb-2 text-lg font-semibold">Terrain</h1>
        {sites.isLoading ? <div className="h-10 animate-pulse rounded-md bg-muted" /> : !list.length ? (
          <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">{sites.isError ? "Pas de réseau et aucun chantier gardé sur ce téléphone : ouvrez cette page une fois connecté." : "Aucun chantier ouvert."}</p>
        ) : (
          <Select value={site ? String(site.id) : undefined} onValueChange={(v) => { setSiteId(Number(v)); setMode(null); }}>
            <SelectTrigger className="h-12 text-left"><SelectValue placeholder="Choisir le chantier" /></SelectTrigger>
            <SelectContent>
              {list.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.reference} — {w.title}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {sites.data?.savedAt && <p className="mt-1 text-xs text-amber-700">Liste gardée sur le téléphone le {formatDateTime(new Date(sites.data.savedAt).toISOString())}.</p>}
      </section>

      {site && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {can("works.manage", "works.cash") && <ActionButton icon={Camera} label="Photo" active={mode === "photo"} onClick={() => setMode(mode === "photo" ? null : "photo")} />}
            {can("works.team") && <ActionButton icon={UserCheck} label="Pointage" active={mode === "pointage"} onClick={() => setMode(mode === "pointage" ? null : "pointage")} />}
            {can("works.cash") && <ActionButton icon={Minus} label="Dépense" active={mode === "depense"} onClick={() => setMode(mode === "depense" ? null : "depense")} />}
          </div>
          {mode === "photo" && <PhotoForm site={site} onDone={() => setMode(null)} />}
          {mode === "pointage" && <AttendanceForm site={site} outbox={outbox.items} onDone={() => setMode(null)} />}
          {mode === "depense" && <ExpenseForm site={site} onDone={() => setMode(null)} />}
          <Link to={`/admin/chantiers/${site.id}`} className="flex items-center justify-center gap-1 text-sm text-muted-foreground hover:underline"><HardHat className="h-4 w-4" /> Fiche complète du chantier</Link>
        </>
      )}

      {outbox.items.length > 0 && <OutboxList items={outbox.items} />}
    </div>
  );
}

function ActionButton({ icon: Icon, label, active, onClick }: { icon: typeof Camera; label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("flex flex-col items-center gap-2 rounded-xl border px-2 py-5 text-sm font-medium shadow-sm transition", active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>
      <Icon className="h-6 w-6" />{label}
    </button>
  );
}

const label = (site: Worksite) => `${site.reference} — ${site.title}`;

function PhotoForm({ site, onDone }: { site: Worksite; onDone: () => void }) {
  const detail = useCachedQuery(`worksite-${site.id}`, () => api<{ data: Worksite }>(`/worksites/${site.id}`).then((r) => r.data));
  const lots = detail.data?.value.lots ?? [];
  const [files, setFiles] = useState<File[]>([]);
  const [caption, setCaption] = useState("");
  const [lotId, setLotId] = useState("none");
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const position = await currentPosition(5000);
      for (const file of files) {
        const blob = await shrinkImage(file);
        const id = uuid();
        await enqueue({
          id, kind: "photo", worksiteId: site.id, worksiteLabel: label(site),
          summary: caption ? `Photo : ${caption}` : "Photo",
          fields: {
            client_uuid: id, caption: caption || null, worksite_lot_id: lotId === "none" ? null : Number(lotId), is_public: isPublic,
            taken_at: new Date(file.lastModified || Date.now()).toISOString(), latitude: position?.latitude ?? null, longitude: position?.longitude ?? null,
          },
          file: blob, fileName: "photo.jpg",
        });
      }
      toast.success(files.length > 1 ? `${files.length} photos gardées : envoi dès que possible.` : "Photo gardée : envoi dès que possible.");
      onDone();
    } catch {
      toast.error("Impossible de garder la photo sur ce téléphone.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Photo du chantier">
      <div className="space-y-3">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm text-muted-foreground hover:bg-muted">
          <ImagePlus className="h-8 w-8" />
          {files.length ? `${files.length} photo${files.length > 1 ? "s" : ""} choisie${files.length > 1 ? "s" : ""}` : "Prendre une photo"}
          <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
        </label>
        <Field label="Légende"><Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Coulage de la dalle" /></Field>
        {lots.length > 0 && (
          <Field label="Étape">
            <Select value={lotId} onValueChange={setLotId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {lots.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        )}
        <label className="flex items-center justify-between text-sm">Visible par le client<Switch checked={isPublic} onCheckedChange={setIsPublic} /></label>
        <Button className="h-12 w-full" disabled={!files.length || busy} onClick={save}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} Enregistrer</Button>
      </div>
    </Panel>
  );
}

type Presence = 0 | 0.5 | 1;

function AttendanceForm({ site, outbox, onDone }: { site: Worksite; outbox: OutboxItem[]; onDone: () => void }) {
  const date = today();
  const workers = useCachedQuery("workers", () => api<Paginated<Worker>>("/workers", { query: { per_page: 200 } }).then((r) => r.data));
  const team = useCachedQuery(`team-${site.id}-${date}`, () => api<{ data: WorksiteTeam }>(`/worksites/${site.id}/team`, { query: { date } }).then((r) => r.data));
  const [presence, setPresence] = useState<Record<number, Presence>>({});
  const [busy, setBusy] = useState(false);

  // Déjà pointé aujourd'hui : enregistré sur le serveur, puis saisies encore en attente sur le téléphone.
  const known = useMemo(() => {
    const map: Record<number, Presence> = {};
    team.data?.value.attendances.forEach((a) => { map[a.worker.id] = a.days as Presence; });
    outbox.filter((i) => i.kind === "attendance" && i.worksiteId === site.id && i.fields.worked_on === date).forEach((i) => {
      (i.fields.entries as Array<{ worker_id: number; days: Presence }>).forEach((e) => { map[e.worker_id] = e.days; });
    });
    return map;
  }, [team.data, outbox, site.id, date]);
  useEffect(() => setPresence(known), [known]);

  const list = (workers.data?.value ?? []).slice().sort((a, b) => Number(b.pay_type.value === "journalier") - Number(a.pay_type.value === "journalier") || a.name.localeCompare(b.name, "fr"));
  const changed = list.filter((w) => (presence[w.id] ?? 0) > 0 && presence[w.id] !== known[w.id]);

  async function save() {
    setBusy(true);
    try {
      const id = uuid();
      await enqueue({
        id, kind: "attendance", worksiteId: site.id, worksiteLabel: label(site),
        summary: `Pointage du ${formatDate(date)} : ${changed.length} tâcheron${changed.length > 1 ? "s" : ""}`,
        fields: { worked_on: date, entries: changed.map((w) => ({ worker_id: w.id, days: presence[w.id], client_uuid: uuid() })) },
      });
      toast.success("Pointage gardé : envoi dès que possible.");
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title={`Pointage du ${formatDate(date)}`} description="Pour retirer une personne pointée par erreur, passez par la fiche du chantier.">
      {workers.isLoading ? <div className="h-24 animate-pulse rounded bg-muted" /> : !list.length ? (
        <p className="text-sm text-muted-foreground">Aucun tâcheron gardé sur ce téléphone : ouvrez cette page une fois connecté.</p>
      ) : (
        <div className="space-y-3">
          <ul className="divide-y rounded-lg border">
            {list.map((w) => {
              const value = presence[w.id] ?? 0;
              const locked = (known[w.id] ?? 0) > 0;
              return (
                <li key={w.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <div className="min-w-0 text-sm"><p className="truncate font-medium">{w.name}</p><p className="text-xs text-muted-foreground">{w.trade?.name ?? (w.pay_type.value === "tache" ? "À la tâche" : "")}</p></div>
                  <div className="flex shrink-0 overflow-hidden rounded-md border text-sm font-medium">
                    {([0, 0.5, 1] as Presence[]).filter((p) => !(locked && p === 0)).map((p) => (
                      <button key={p} type="button" onClick={() => setPresence((s) => ({ ...s, [w.id]: p }))}
                        className={cn("px-3 py-2", value === p ? (p === 0 ? "bg-muted" : "bg-primary text-primary-foreground") : "hover:bg-muted")}>
                        {p === 0 ? "—" : p === 0.5 ? "½" : "1 j"}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
          <Button className="h-12 w-full" disabled={!changed.length || busy} onClick={save}>Enregistrer {changed.length ? `(${changed.length})` : ""}</Button>
        </div>
      )}
    </Panel>
  );
}

function ExpenseForm({ site, onDone }: { site: Worksite; onDone: () => void }) {
  const [category, setCategory] = useState("materiaux");
  const [amount, setAmount] = useState<number | "">("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const id = uuid();
      await enqueue({
        id, kind: "expense", worksiteId: site.id, worksiteLabel: label(site),
        summary: `${text} — ${cfa(amount || 0)}`,
        fields: { kind: "depense", client_uuid: id, category, amount: amount || 0, label: text, spent_on: today() },
        file: file ? await shrinkImage(file) : null, fileName: "recu.jpg",
      });
      toast.success("Dépense gardée : envoi dès que possible.");
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Dépense payée avec la caisse du chantier">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button key={c.value} type="button" onClick={() => setCategory(c.value)}
              className={cn("rounded-full border px-3 py-1.5 text-sm", category === c.value ? "border-primary bg-primary/5 font-medium text-primary ring-1 ring-primary" : "hover:bg-muted")}>{c.label}</button>
          ))}
        </div>
        <Field label="Montant"><MoneyInput value={amount} onChange={setAmount} /></Field>
        <Field label="Quoi ?"><Input value={text} onChange={(e) => setText(e.target.value)} placeholder="10 sacs de ciment" /></Field>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground hover:bg-muted">
          <Camera className="h-5 w-5" /> {file ? "Reçu photographié" : "Photo du reçu"}
          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <Button className="h-12 w-full" disabled={!amount || !text.trim() || busy} onClick={save}>Enregistrer</Button>
      </div>
    </Panel>
  );
}

function OutboxList({ items }: { items: OutboxItem[] }) {
  return (
    <Panel title="Sur ce téléphone" description="Saisies pas encore reçues par le bureau." bodyClassName="p-0">
      <ul className="divide-y">
        {items.map((i) => (
          <li key={i.id} className="flex items-start gap-3 px-4 py-3 text-sm">
            <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", i.error ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700")}>
              {i.kind === "photo" ? <Camera className="h-3.5 w-3.5" /> : i.kind === "attendance" ? <UserCheck className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{i.summary}</p>
              <p className="truncate text-xs text-muted-foreground">{i.worksiteLabel} · {formatDateTime(new Date(i.createdAt).toISOString())}</p>
              {i.error ? <p className="text-xs text-red-600">Refusé : {i.error}</p> : i.attempts > 0 && <p className="flex items-center gap-1 text-xs text-amber-700"><RefreshCw className="h-3 w-3" /> {i.attempts} essai{i.attempts > 1 ? "s" : ""}, nouvel essai automatique</p>}
            </div>
            {i.error && <Button size="icon" variant="ghost" title="Abandonner cette saisie" onClick={() => { if (confirm("Abandonner cette saisie ? Elle sera effacée du téléphone.")) void discard(i.id); }}><Trash2 className="h-4 w-4" /></Button>}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
