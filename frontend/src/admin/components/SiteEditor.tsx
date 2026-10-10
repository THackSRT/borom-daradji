/**
 * Briques de l'écran « Site internet » : champs avec compteur, listes réordonnables, choix d'icône,
 * images envoyées au serveur, couleurs.
 */
import { createContext, useContext, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ImagePlus, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SiteIcon, siteIcons } from "@/components/site/SiteIcon";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Field, Spinner } from "./ui";

/* ---------- Contexte : erreurs de validation et images ---------- */

interface EditorContextValue {
  error: (field: string) => string | undefined;
  /** Vrai si un champ sous ce préfixe (« services.2 ») a une erreur : la fiche s'ouvre d'elle-même. */
  hasErrorUnder: (prefix: string) => boolean;
  imageUrl: (value: string | null | undefined) => string | null;
  rememberImage: (path: string, url: string) => void;
}

const EditorContext = createContext<EditorContextValue>({
  error: () => undefined,
  hasErrorUnder: () => false,
  imageUrl: (value) => value ?? null,
  rememberImage: () => undefined,
});

export function SiteEditorProvider({
  error,
  imageUrls,
  children,
}: {
  error: ApiError | null;
  imageUrls: Record<string, string>;
  children: ReactNode;
}) {
  const [uploaded, setUploaded] = useState<Record<string, string>>({});
  const value: EditorContextValue = {
    error: (field) => error?.field(field),
    hasErrorUnder: (prefix) => Object.keys(error?.errors ?? {}).some((key) => key.startsWith(`${prefix}.`)),
    imageUrl: (v) => (!v ? null : v.startsWith("http") ? v : uploaded[v] ?? imageUrls[v] ?? null),
    rememberImage: (path, url) => setUploaded((prev) => ({ ...prev, [path]: url })),
  };
  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export const useEditor = () => useContext(EditorContext);

/* ---------- Champs ---------- */

export function TextField({
  label,
  name,
  value,
  onChange,
  max,
  multiline = false,
  rows = 3,
  hint,
  placeholder,
  className,
}: {
  label: string;
  /** Nom du champ dans l'API, pour afficher l'erreur renvoyée (ex. « services.0.title »). */
  name: string;
  value: string | null | undefined;
  onChange: (value: string) => void;
  max?: number;
  multiline?: boolean;
  rows?: number;
  hint?: string;
  placeholder?: string;
  className?: string;
}) {
  const { error } = useEditor();
  const text = value ?? "";
  const counter = max ? `${text.length}/${max}` : undefined;
  const over = max !== undefined && text.length > max;
  return (
    <Field label={label} htmlFor={name} error={error(name)} hint={hint} className={className}>
      <div className="relative">
        {multiline ? (
          <Textarea id={name} rows={rows} value={text} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="pr-14" />
        ) : (
          <Input id={name} value={text} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="pr-14" />
        )}
        {counter && (
          <span className={cn("pointer-events-none absolute right-2.5 top-2.5 text-[10px] tabular-nums", over ? "text-destructive" : "text-muted-foreground/70")}>
            {counter}
          </span>
        )}
      </div>
    </Field>
  );
}

/** Interrupteur « afficher ce bloc sur le site ». */
export function ToggleRow({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border bg-muted/30 px-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-xs text-muted-foreground">{description}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

export function ColorField({ label, name, value, onChange, hint }: { label: string; name: string; value: string; onChange: (v: string) => void; hint?: string }) {
  const { error } = useEditor();
  return (
    <Field label={label} htmlFor={name} error={error(name)} hint={hint}>
      <div className="flex items-center gap-2">
        <label className="relative h-10 w-12 flex-shrink-0 cursor-pointer overflow-hidden rounded-md border shadow-sm" style={{ background: value }}>
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label={label} />
        </label>
        <Input id={name} value={value} onChange={(e) => onChange(e.target.value)} className="font-mono uppercase" maxLength={7} />
      </div>
    </Field>
  );
}

export function IconPicker({ value, onChange, name }: { value: string; onChange: (v: string) => void; name: string }) {
  const [open, setOpen] = useState(false);
  const { error } = useEditor();
  return (
    <div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="h-10 w-full justify-between gap-2 px-3" aria-label="Choisir l'icône">
            <span className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent"><SiteIcon name={value} className="h-4 w-4" /></span>
              <span className="text-sm">{siteIcons[value]?.label ?? "Icône"}</span>
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          <div className="grid grid-cols-6 gap-1">
            {Object.entries(siteIcons).map(([key, { icon: Icon, label }]) => (
              <button key={key} type="button" title={label} aria-label={label}
                onClick={() => { onChange(key); setOpen(false); }}
                className={cn("flex h-10 items-center justify-center rounded-md transition hover:bg-accent", key === value && "bg-primary text-primary-foreground hover:bg-primary")}>
                <Icon className="h-5 w-5" />
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      {error(name) && <p className="mt-1 text-xs font-medium text-destructive">{error(name)}</p>}
    </div>
  );
}

/** Image envoyée au serveur (convertie en WebP) ; la valeur enregistrée est son chemin. */
export function ImageField({
  label,
  name,
  value,
  onChange,
  hint,
  fallback,
  aspect = "aspect-[16/9]",
  removable = true,
}: {
  label: string;
  name: string;
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  hint?: string;
  /** Image affichée quand aucune n'est choisie (image d'origine du site). */
  fallback?: string;
  aspect?: string;
  removable?: boolean;
}) {
  const { error, imageUrl, rememberImage } = useEditor();
  const [uploading, setUploading] = useState(false);
  const url = imageUrl(value);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("image", file);
      const { data } = await api<{ data: { path: string; url: string } }>("/settings/site/images", { method: "POST", body });
      rememberImage(data.path, data.url);
      onChange(data.path);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.field("image") ?? e.message : "Envoi impossible.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Field label={label} error={error(name)} hint={hint}>
      <div className={cn("group relative overflow-hidden rounded-lg border bg-muted/40", aspect)}>
        {url || fallback ? (
          <img src={url ?? fallback} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Aucune image</div>
        )}
        {!url && fallback && <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[10px] text-white">Image d'origine</span>}
        {uploading && <div className="absolute inset-0 flex items-center justify-center bg-white/70"><Spinner /></div>}
        <div className="absolute inset-x-2 bottom-2 flex gap-2">
          <Button asChild size="sm" variant="secondary" className="shadow">
            <label className="cursor-pointer">
              <ImagePlus className="h-4 w-4" /> {url ? "Remplacer" : "Choisir"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
            </label>
          </Button>
          {url && removable && (
            <Button type="button" size="sm" variant="secondary" className="shadow" onClick={() => onChange(null)}>
              <X className="h-4 w-4" /> Retirer
            </Button>
          )}
        </div>
      </div>
    </Field>
  );
}

/* ---------- Listes ---------- */

function move<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function RowActions({ index, count, onMove, onRemove }: { index: number; count: number; onMove: (to: number) => void; onRemove: () => void }) {
  return (
    <div className="flex flex-shrink-0 items-center">
      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={index === 0} onClick={() => onMove(index - 1)} aria-label="Monter">
        <ArrowUp className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={index === count - 1} onClick={() => onMove(index + 1)} aria-label="Descendre">
        <ArrowDown className="h-4 w-4" />
      </Button>
      <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={onRemove} aria-label="Supprimer">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

/** Liste de phrases courtes (points forts, engagements, sujets…). */
export function StringListEditor({
  label,
  name,
  items,
  onChange,
  max,
  placeholder,
  addLabel = "Ajouter",
  hint,
}: {
  label: string;
  name: string;
  items: string[] | null | undefined;
  onChange: (items: string[]) => void;
  max: number;
  placeholder?: string;
  addLabel?: string;
  hint?: string;
}) {
  const { error } = useEditor();
  const list = items ?? [];
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className="text-[10px] text-muted-foreground">{list.length}/{max}</span>
      </div>
      {list.map((item, i) => (
        <div key={i}>
          <div className="flex items-center gap-1">
            <Input value={item} placeholder={placeholder} aria-label={`${label} ${i + 1}`}
              onChange={(e) => onChange(list.map((v, j) => (j === i ? e.target.value : v)))} />
            <RowActions index={i} count={list.length} onMove={(to) => onChange(move(list, i, to))} onRemove={() => onChange(list.filter((_, j) => j !== i))} />
          </div>
          {error(`${name}.${i}`) && <p className="mt-1 text-xs font-medium text-destructive">{error(`${name}.${i}`)}</p>}
        </div>
      ))}
      {error(name) && <p className="text-xs font-medium text-destructive">{error(name)}</p>}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {list.length < max && (
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...list, ""])}>
          <Plus className="h-4 w-4" /> {addLabel}
        </Button>
      )}
    </div>
  );
}

/** Liste de fiches (services, chiffres, réalisations) : chaque fiche se replie, se déplace, se supprime. */
export function CardListEditor<T>({
  label,
  name,
  items,
  onChange,
  max,
  create,
  title,
  render,
  addLabel = "Ajouter",
}: {
  label: string;
  name: string;
  items: T[];
  onChange: (items: T[]) => void;
  max: number;
  create: () => T;
  title: (item: T, index: number) => ReactNode;
  render: (item: T, update: (patch: Partial<T>) => void, prefix: string) => ReactNode;
  addLabel?: string;
}) {
  const { error, hasErrorUnder } = useEditor();
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className="text-[10px] text-muted-foreground">{items.length}/{max}</span>
      </div>
      {items.map((item, i) => {
        const prefix = `${name}.${i}`;
        const hasError = hasErrorUnder(prefix);
        const expanded = open === i || hasError;
        return (
          <div key={i} className={cn("rounded-lg border bg-card", hasError && "border-destructive/60")}>
            <div className="flex items-center gap-2 py-1 pl-3 pr-1">
              <button type="button" className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-sm font-medium" onClick={() => setOpen(expanded ? null : i)} aria-expanded={expanded}>
                <ChevronDown className={cn("h-4 w-4 flex-shrink-0 text-muted-foreground transition", expanded && "rotate-180")} />
                <span className="min-w-0 truncate">{title(item, i)}</span>
              </button>
              <RowActions
                index={i}
                count={items.length}
                onMove={(to) => { onChange(move(items, i, to)); setOpen(to); }}
                onRemove={() => { if (window.confirm("Supprimer cet élément ?")) { onChange(items.filter((_, j) => j !== i)); setOpen(null); } }}
              />
            </div>
            {expanded && (
              <div className="space-y-4 border-t p-4">
                {render(item, (patch) => onChange(items.map((v, j) => (j === i ? { ...v, ...patch } : v))), prefix)}
              </div>
            )}
          </div>
        );
      })}
      {error(name) && <p className="text-xs font-medium text-destructive">{error(name)}</p>}
      {items.length < max && (
        <Button type="button" variant="outline" size="sm" onClick={() => { onChange([...items, create()]); setOpen(items.length); }}>
          <Plus className="h-4 w-4" /> {addLabel}
        </Button>
      )}
    </div>
  );
}

/** Groupe de champs titré à l'intérieur d'un onglet. */
export function EditorGroup({ title, description, children, aside }: { title: string; description?: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card shadow-sm">
      <header className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {aside}
      </header>
      <div className="space-y-4 p-5">{children}</div>
    </section>
  );
}
