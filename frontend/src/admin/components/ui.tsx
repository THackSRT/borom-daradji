import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Loader2, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Option } from "../types";

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
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
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-muted-foreground", className)} />;
}

export function LoadingBlock() {
  return (
    <div className="flex justify-center py-16">
      <Spinner className="h-6 w-6" />
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">{children}</div>;
}

const tones: Record<string, string> = {
  // Biens
  brouillon: "bg-slate-100 text-slate-700",
  disponible: "bg-emerald-100 text-emerald-800",
  en_negociation: "bg-amber-100 text-amber-800",
  sous_promesse: "bg-blue-100 text-blue-800",
  vendu: "bg-navy text-primary-foreground",
  loue: "bg-navy text-primary-foreground",
  retire: "bg-slate-200 text-slate-600",
  // Vérification foncière
  a_faire: "bg-slate-100 text-slate-700",
  ok: "bg-emerald-100 text-emerald-800",
  ko: "bg-red-100 text-red-800",
  sans_objet: "bg-slate-100 text-slate-500",
  // Prospects
  nouveau: "bg-blue-100 text-blue-800",
  contacte: "bg-sky-100 text-sky-800",
  visite: "bg-violet-100 text-violet-800",
  negociation: "bg-amber-100 text-amber-800",
  gagne: "bg-emerald-100 text-emerald-800",
  perdu: "bg-slate-200 text-slate-600",
  // Visites
  planifiee: "bg-blue-100 text-blue-800",
  effectuee: "bg-emerald-100 text-emerald-800",
  annulee: "bg-slate-200 text-slate-600",
  absent: "bg-red-100 text-red-800",
  // Mandats, priorités
  actif: "bg-emerald-100 text-emerald-800",
  expire: "bg-red-100 text-red-800",
  resilie: "bg-slate-200 text-slate-600",
  haute: "bg-red-100 text-red-800",
  normale: "bg-slate-100 text-slate-700",
  basse: "bg-slate-50 text-slate-500",
};

export function StatusBadge({ option, className }: { option: Option | null | undefined; className?: string }) {
  if (!option) return null;
  return (
    <Badge variant="outline" className={cn("border-transparent font-medium", tones[option.value] ?? "bg-secondary", className)}>
      {option.label}
    </Badge>
  );
}

export function WhatsAppLink({ url, label = "WhatsApp" }: { url: string | null | undefined; label?: string }) {
  if (!url) return null;
  return (
    <Button asChild variant="outline" size="sm" className="border-emerald-600/40 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800">
      <a href={url} target="_blank" rel="noreferrer">
        <MessageCircle className="h-4 w-4" />
        {label}
      </a>
    </Button>
  );
}

export function Pagination({
  page,
  lastPage,
  total,
  onChange,
}: {
  page: number;
  lastPage: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (lastPage <= 1) return <p className="mt-4 text-xs text-muted-foreground">{total} résultat(s)</p>;
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
      <span>{total} résultat(s)</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Page précédente">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span>
          {page} / {lastPage}
        </span>
        <Button variant="outline" size="icon" disabled={page >= lastPage} onClick={() => onChange(page + 1)} aria-label="Page suivante">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/** Message d'erreur générale d'un formulaire (hors erreurs par champ). */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{message}</p>;
}
