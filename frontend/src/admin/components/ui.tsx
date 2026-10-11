import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Inbox, Loader2, MessageCircle, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Option } from "../types";

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[1.75rem]">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Bloc blanc arrondi avec un titre et, à droite, une action. */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card shadow-sm", className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Libellé + champ + message d'erreur renvoyé par l'API. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {error ? <p className="text-xs font-medium text-destructive">{error}</p> : hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-muted-foreground", className)} />;
}

/** Chargement : des silhouettes de lignes plutôt qu'un sablier. */
export function LoadingBlock({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border bg-card">
          <Skeleton className="aspect-[16/10] rounded-none" />
          <div className="space-y-2 p-4"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-1/3" /></div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  children,
  action,
  compact = false,
}: {
  icon?: LucideIcon;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 text-center", compact ? "p-6" : "p-10")}>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      {title && <p className="text-sm font-medium text-foreground">{title}</p>}
      {children && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const tones: Record<string, string> = {
  brouillon: "bg-slate-100 text-slate-700 [--dot:theme(colors.slate.400)]",
  disponible: "bg-emerald-50 text-emerald-700 [--dot:theme(colors.emerald.500)]",
  en_negociation: "bg-amber-50 text-amber-700 [--dot:theme(colors.amber.500)]",
  sous_promesse: "bg-blue-50 text-blue-700 [--dot:theme(colors.blue.500)]",
  vendu: "bg-indigo-50 text-indigo-700 [--dot:theme(colors.indigo.500)]",
  loue: "bg-indigo-50 text-indigo-700 [--dot:theme(colors.indigo.500)]",
  retire: "bg-slate-100 text-slate-500 [--dot:theme(colors.slate.400)]",
  a_faire: "bg-slate-100 text-slate-600 [--dot:theme(colors.slate.400)]",
  ok: "bg-emerald-50 text-emerald-700 [--dot:theme(colors.emerald.500)]",
  ko: "bg-red-50 text-red-700 [--dot:theme(colors.red.500)]",
  sans_objet: "bg-slate-100 text-slate-500 [--dot:theme(colors.slate.400)]",
  nouveau: "bg-blue-50 text-blue-700 [--dot:theme(colors.blue.500)]",
  contacte: "bg-sky-50 text-sky-700 [--dot:theme(colors.sky.500)]",
  visite: "bg-violet-50 text-violet-700 [--dot:theme(colors.violet.500)]",
  negociation: "bg-amber-50 text-amber-700 [--dot:theme(colors.amber.500)]",
  gagne: "bg-emerald-50 text-emerald-700 [--dot:theme(colors.emerald.500)]",
  perdu: "bg-slate-100 text-slate-500 [--dot:theme(colors.slate.400)]",
  planifiee: "bg-blue-50 text-blue-700 [--dot:theme(colors.blue.500)]",
  effectuee: "bg-emerald-50 text-emerald-700 [--dot:theme(colors.emerald.500)]",
  annulee: "bg-slate-100 text-slate-500 [--dot:theme(colors.slate.400)]",
  absent: "bg-red-50 text-red-700 [--dot:theme(colors.red.500)]",
  interesse: "bg-emerald-50 text-emerald-700 [--dot:theme(colors.emerald.500)]",
  pas_interesse: "bg-slate-100 text-slate-500 [--dot:theme(colors.slate.400)]",
  a_revoir: "bg-amber-50 text-amber-700 [--dot:theme(colors.amber.500)]",
  actif: "bg-emerald-50 text-emerald-700 [--dot:theme(colors.emerald.500)]",
  expire: "bg-red-50 text-red-700 [--dot:theme(colors.red.500)]",
  resilie: "bg-slate-100 text-slate-500 [--dot:theme(colors.slate.400)]",
  haute: "bg-red-50 text-red-700 [--dot:theme(colors.red.500)]",
  normale: "bg-slate-100 text-slate-600 [--dot:theme(colors.slate.400)]",
  basse: "bg-slate-50 text-slate-500 [--dot:theme(colors.slate.300)]",
  emise: "bg-blue-50 text-blue-700 [--dot:theme(colors.blue.500)]",
  non_payee: "bg-amber-50 text-amber-700 [--dot:theme(colors.amber.500)]",
  partielle: "bg-sky-50 text-sky-700 [--dot:theme(colors.sky.500)]",
  payee: "bg-emerald-50 text-emerald-700 [--dot:theme(colors.emerald.500)]",
  en_retard: "bg-red-50 text-red-700 [--dot:theme(colors.red.500)]",
  envoye: "bg-blue-50 text-blue-700 [--dot:theme(colors.blue.500)]",
  accepte: "bg-emerald-50 text-emerald-700 [--dot:theme(colors.emerald.500)]",
  refuse: "bg-slate-100 text-slate-500 [--dot:theme(colors.slate.400)]",
  devis: "bg-slate-100 text-slate-600 [--dot:theme(colors.slate.400)]",
  planifie: "bg-blue-50 text-blue-700 [--dot:theme(colors.blue.500)]",
  en_cours: "bg-amber-50 text-amber-700 [--dot:theme(colors.amber.500)]",
  suspendu: "bg-orange-50 text-orange-700 [--dot:theme(colors.orange.500)]",
  termine: "bg-emerald-50 text-emerald-700 [--dot:theme(colors.emerald.500)]",
  facture: "bg-indigo-50 text-indigo-700 [--dot:theme(colors.indigo.500)]",
};

/** Pastille de statut : point de couleur + libellé. */
export function StatusBadge({ option, className }: { option: Option | null | undefined; className?: string }) {
  if (!option) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium", tones[option.value] ?? "bg-secondary text-secondary-foreground", className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--dot,currentColor)]" />
      {option.label}
    </span>
  );
}

export function WhatsAppLink({ url, label = "WhatsApp", size = "sm" }: { url: string | null | undefined; label?: string; size?: "sm" | "icon" }) {
  if (!url) return null;
  return (
    <Button asChild variant="outline" size={size} className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800">
      <a href={url} target="_blank" rel="noreferrer" aria-label="Écrire sur WhatsApp">
        <MessageCircle className="h-4 w-4" />
        {size !== "icon" && label}
      </a>
    </Button>
  );
}

export function Pagination({ page, lastPage, total, onChange }: { page: number; lastPage: number; total: number; onChange: (page: number) => void }) {
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
      <span>{total} résultat{total > 1 ? "s" : ""}</span>
      {lastPage > 1 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Page précédente"><ChevronLeft className="h-4 w-4" /></Button>
          <span className="tabular-nums">{page} / {lastPage}</span>
          <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= lastPage} onClick={() => onChange(page + 1)} aria-label="Page suivante"><ChevronRight className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">{message}</p>;
}

/** Initiales sur fond coloré, stable pour un même nom. */
export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
  const palette = ["bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-800", "bg-violet-100 text-violet-700", "bg-rose-100 text-rose-700", "bg-sky-100 text-sky-700"];
  const color = palette[[...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % palette.length];
  const sizes = { sm: "h-7 w-7 text-[11px]", md: "h-9 w-9 text-xs", lg: "h-14 w-14 text-lg" };
  return <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", color, sizes[size], className)}>{initials || "?"}</span>;
}

/** Petite barre de progression (ex. vérification foncière 4/6). */
export function ProgressBar({ value, total, className, label }: { value: number; total: number; className?: string; label?: string }) {
  const pct = total ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{label ?? `${value}/${total}`}</span>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  onClick,
  className,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: LucideIcon;
  tone?: "default" | "warning" | "danger" | "success";
  onClick?: () => void;
  className?: string;
}) {
  const tones = {
    default: "bg-primary/10 text-primary",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-red-100 text-red-700",
    success: "bg-emerald-100 text-emerald-700",
  };
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cn("flex min-w-0 flex-col items-start gap-3 rounded-xl border bg-card p-3 text-left shadow-sm transition sm:flex-row sm:gap-4 sm:p-4", onClick && "hover:border-primary/30 hover:shadow-md", className)}
    >
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", tones[tone])}>
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className={cn("block font-semibold tabular-nums leading-tight text-foreground", String(value).length > 9 ? "text-lg sm:text-xl" : "text-2xl")}>{value}</span>
        <span className="block text-xs text-muted-foreground sm:text-sm">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-muted-foreground/80">{hint}</span>}
      </span>
    </Tag>
  );
}

/** Pastilles de filtre rapide avec compteur. */
export function FilterChips<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; count?: number }[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition",
            value === o.value ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
          )}
        >
          {o.label}
          {o.count !== undefined && (
            <span className={cn("rounded-full px-1.5 text-xs tabular-nums", value === o.value ? "bg-white/20" : "bg-muted")}>{o.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
