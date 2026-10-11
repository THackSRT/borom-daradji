import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Worksite, WorksiteBudget } from "../../types";
import { AmountRow, cfa } from "../billing";
import { Panel } from "../ui";

/** Onglet « Budget » : prévu et réel par poste (main-d'œuvre des tâcherons + dépenses de la caisse), marge. */
export function BudgetTab({ worksite, onEdit }: { worksite: Worksite; onEdit?: () => void }) {
  const { data: b } = useQuery({
    queryKey: ["worksite-budget", worksite.id],
    queryFn: () => api<{ data: WorksiteBudget }>(`/worksites/${worksite.id}/budget`).then((r) => r.data),
  });
  if (!b) return <Panel><p className="text-sm text-muted-foreground">Chargement…</p></Panel>;

  const lines = [
    { key: "materials", label: "Matériaux", hint: "Dépenses « matériaux » de la caisse du chantier" },
    { key: "labor", label: "Main-d'œuvre", hint: `${b.labor_detail.days.toLocaleString("fr-FR")} jour(s) pointé(s) : ${cfa(b.labor_detail.attendances)} · tâches terminées : ${cfa(b.labor_detail.tasks)}` },
    { key: "other", label: "Autres", hint: "Transport, outillage, divers" },
  ] as const;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Panel title="Budget prévu et coût réel" action={onEdit && <Button size="sm" variant="outline" onClick={onEdit}><Pencil className="h-4 w-4" /> Budget</Button>}>
        {b.over_budget && (
          <p className="mb-4 flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Budget dépassé de plus de {b.tolerance} % ({b.consumed_rate} % consommé).{b.alerted_at && ` Alerte envoyée le ${formatDateTime(b.alerted_at)}.`}</span>
          </p>
        )}
        {b.planned.total === 0 && <p className="mb-4 text-sm text-muted-foreground">Aucun budget saisi : renseignez-le pour suivre les dépassements (alerte au-delà de {b.tolerance} %).</p>}
        <div className="space-y-4">
          {lines.map((l) => <BudgetLine key={l.key} label={l.label} hint={l.hint} planned={b.planned[l.key]} actual={b.actual[l.key]} tolerance={b.tolerance} />)}
          <div className="border-t pt-4"><BudgetLine label="Total" planned={b.planned.total} actual={b.actual.total} tolerance={b.tolerance} strong /></div>
        </div>
      </Panel>
      <aside className="space-y-4">
        <Panel title="Marge">
          <AmountRow label="Marché HT" value={b.contract_ht} tone="muted" />
          <AmountRow label="Coût réel" value={-b.actual.total} tone="muted" />
          <AmountRow label="Marge actuelle" value={b.margin} strong tone={b.margin < 0 ? "red" : "green"} />
          {b.contract_ht > 0 && <p className="mt-1 text-xs text-muted-foreground">{Math.round((b.margin / b.contract_ht) * 100)} % du marché. Le stock sorti vers le chantier s'ajoutera avec le lot 4.</p>}
        </Panel>
        <Panel title="Dépenses par catégorie">
          {b.expenses_by_category.map((c) => <AmountRow key={c.key} label={c.label} value={c.total} tone={c.total ? undefined : "muted"} />)}
          <p className="mt-2 text-xs text-muted-foreground">Caisse du chantier : {cfa(b.cash_balance)} en main.</p>
        </Panel>
      </aside>
    </div>
  );
}

function BudgetLine({ label, hint, planned, actual, tolerance, strong }: { label: string; hint?: string; planned: number; actual: number; tolerance: number; strong?: boolean }) {
  const pct = planned ? Math.round((actual / planned) * 100) : null;
  const over = planned > 0 && actual * 100 > planned * (100 + tolerance);
  const near = planned > 0 && !over && actual > planned;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className={cn(strong && "font-semibold")}>{label}</span>
        <span className="tabular-nums"><span className={cn(strong && "font-semibold", over && "text-red-600")}>{cfa(actual)}</span> <span className="text-muted-foreground">/ {planned ? cfa(planned) : "—"}</span></span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", over ? "bg-red-500" : near ? "bg-orange-400" : "bg-emerald-500")} style={{ width: `${Math.min(100, pct ?? (actual ? 100 : 0))}%` }} />
      </div>
      <div className="mt-1 flex justify-between gap-3 text-xs text-muted-foreground">
        <span>{hint}</span>
        {pct !== null && <span className={cn("shrink-0 tabular-nums", over && "font-medium text-red-600")}>{pct} %</span>}
      </div>
    </div>
  );
}
