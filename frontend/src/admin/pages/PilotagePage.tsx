import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Banknote, FileSpreadsheet, HardHat, KeyRound, Package, Receipt, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Option } from "../types";
import { cfa } from "../components/billing";
import { PeriodPicker } from "../components/PeriodPicker";
import { periodQuery, type Period } from "../period";
import { LoadingBlock, PageHeader, Panel } from "../components/ui";
import { useAuth } from "../auth";

interface Overview {
  period: { from: string; to: string };
  previous_period: { from: string; to: string };
  revenue: { total: number; previous_total: number; by_activity: { activity: Option; amount: number }[]; monthly: Record<string, number | string>[] };
  collections: { total: number; previous_total: number; count: number; by_method: { method: Option; amount: number }[] };
  receivables: { total: number; overdue: number; buckets: Record<"not_due" | "d0_30" | "d31_60" | "d61_90" | "over_90", number>; top_debtors: { client: { id: number; name: string; phone: string | null }; amount: number; invoices: number }[] };
  rents: { count: number; amount: number; tenants: number };
  worksites: { open: number; late: number; over_budget: number; attention: { id: number; reference: string; title: string; client: string | null; progress: number; planned_end_date: string | null; is_late: boolean; over_budget: boolean; consumed_rate: number | null }[] };
  stock: { value: number; low_count: number; low: { id: number; reference: string; name: string; unit: string; quantity: number; min_quantity: number }[] };
  payables: { total: number; overdue: number; count: number };
}

/** Couleurs des activités : palette catégorielle validée (ordre fixe, une couleur par activité, jamais réattribuée). */
const ACTIVITY_COLORS: Record<string, string> = {
  immobilier: "#2a78d6",
  location: "#eb6834",
  travaux: "#1baf7a",
  negoce: "#eda100",
  autre: "#e87ba4",
};

const BUCKETS: { key: keyof Overview["receivables"]["buckets"]; label: string }[] = [
  { key: "not_due", label: "Pas encore échu" },
  { key: "d0_30", label: "Échu depuis 1 à 30 j" },
  { key: "d31_60", label: "31 à 60 j" },
  { key: "d61_90", label: "61 à 90 j" },
  { key: "over_90", label: "Plus de 90 j" },
];

const compact = (n: number) => new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(n);

/** Tableau de bord du dirigeant : chiffre d'affaires, encaissements, impayés, chantiers, stock. */
export default function PilotagePage() {
  const { can } = useAuth();
  const today = new Date().toLocaleDateString("en-CA");
  const [period, setPeriod] = useState<Period>({ preset: "mois", from: today.slice(0, 8) + "01", to: today });
  const query = periodQuery(period);
  const { data, isLoading } = useQuery({
    queryKey: ["reports-overview", query],
    queryFn: () => api<{ data: Overview }>("/reports/overview", { query }).then((r) => r.data),
  });

  return (
    <>
      <PageHeader title="Pilotage" description={data ? `Du ${formatDate(data.period.from)} au ${formatDate(data.period.to)}, comparé au ${formatDate(data.previous_period.from)} – ${formatDate(data.previous_period.to)}.` : "Activité de l'agence."}
        actions={can("reports.export") && <Button variant="outline" asChild><Link to="/admin/exports"><FileSpreadsheet className="h-4 w-4" /> Exports comptables</Link></Button>} />
      <div className="mb-6"><PeriodPicker value={period} onChange={setPeriod} /></div>
      {isLoading || !data ? <LoadingBlock rows={6} /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi icon={Receipt} label="Chiffre d'affaires HT" value={data.revenue.total} previous={data.revenue.previous_total} />
            <Kpi icon={Banknote} label="Encaissé" value={data.collections.total} previous={data.collections.previous_total} hint={`${data.collections.count} encaissement(s)`} />
            <Kpi icon={AlertTriangle} label="Reste à encaisser" value={data.receivables.total} hint={`dont ${cfa(data.receivables.overdue)} échus`} tone={data.receivables.overdue ? "warning" : undefined} />
            <Kpi icon={Truck} label="Dû aux fournisseurs" value={data.payables.total} hint={data.payables.overdue ? `dont ${cfa(data.payables.overdue)} en retard` : `${data.payables.count} achat(s) à payer`} tone={data.payables.overdue ? "warning" : undefined} />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <MonthlyRevenue monthly={data.revenue.monthly} activities={data.revenue.by_activity.map((a) => a.activity)} />
            <Panel title="Chiffre d'affaires de la période">
              <HBars rows={data.revenue.by_activity.map((a) => ({ key: a.activity.value, label: a.activity.label, amount: a.amount, color: ACTIVITY_COLORS[a.activity.value] }))} total={data.revenue.total} />
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel title="Impayés par ancienneté" action={<span className="text-sm font-medium tabular-nums">{cfa(data.receivables.total)}</span>}>
              <HBars rows={BUCKETS.map((b) => ({ key: b.key, label: b.label, amount: data.receivables.buckets[b.key], color: b.key === "not_due" ? "#86b6ef" : "#2a78d6" }))} total={data.receivables.total} />
              {data.receivables.top_debtors.length > 0 && (
                <div className="mt-4 border-t pt-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Principaux débiteurs</p>
                  <ul className="space-y-1.5 text-sm">
                    {data.receivables.top_debtors.map((d) => (
                      <li key={d.client.id} className="flex justify-between gap-3">
                        <Link to={`/admin/clients/${d.client.id}`} className="truncate hover:underline">{d.client.name} <span className="text-xs text-muted-foreground">· {d.invoices} facture(s)</span></Link>
                        <span className="shrink-0 tabular-nums">{cfa(d.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>
            <Panel title="Encaissements par mode" action={<span className="text-sm font-medium tabular-nums">{cfa(data.collections.total)}</span>}>
              {data.collections.by_method.length ? (
                <HBars rows={data.collections.by_method.map((m) => ({ key: m.method.value, label: m.method.label, amount: m.amount, color: "#2a78d6" }))} total={data.collections.total} />
              ) : <p className="text-sm text-muted-foreground">Aucun encaissement sur la période.</p>}
              <p className="mt-3 text-xs text-muted-foreground">Hors retenues sur caution (ce n'est pas de l'argent reçu).</p>
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel title="Loyers en retard" action={<KeyRound className="h-4 w-4 text-muted-foreground" />}>
              <p className="text-2xl font-semibold tabular-nums">{cfa(data.rents.amount)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{data.rents.count} loyer(s) échu(s), {data.rents.tenants} locataire(s)</p>
              {can("leases.view") && <Link to="/admin/baux" className="mt-3 inline-block text-sm font-medium text-primary hover:underline">Voir les baux</Link>}
            </Panel>
            <Panel title="Chantiers à surveiller" action={<span className="text-xs text-muted-foreground">{data.worksites.open} ouvert(s)</span>} bodyClassName="p-0">
              {!data.worksites.attention.length ? <p className="p-5 text-sm text-muted-foreground">Aucun chantier en retard ni hors budget.</p> : (
                <ul className="divide-y">
                  {data.worksites.attention.map((w) => (
                    <li key={w.id} className="px-5 py-2.5 text-sm">
                      <Link to={`/admin/chantiers/${w.id}`} className="font-medium hover:underline">{w.title}</Link>
                      <p className="text-xs text-muted-foreground">{w.reference} · {w.progress} %
                        {w.is_late && <span className="text-red-600"> · en retard ({formatDate(w.planned_end_date)})</span>}
                        {w.over_budget && <span className="text-red-600"> · budget {w.consumed_rate} %</span>}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <p className="flex items-center gap-1 border-t px-5 py-2 text-xs text-muted-foreground"><HardHat className="h-3.5 w-3.5" /> {data.worksites.late} en retard · {data.worksites.over_budget} hors budget</p>
            </Panel>
            <Panel title="Stock sous le seuil" action={<span className="text-xs text-muted-foreground">valeur {cfa(data.stock.value)}</span>} bodyClassName="p-0">
              {!data.stock.low.length ? <p className="p-5 text-sm text-muted-foreground">Aucun article sous son seuil d'alerte.</p> : (
                <ul className="divide-y">
                  {data.stock.low.map((a) => (
                    <li key={a.id} className="flex justify-between gap-3 px-5 py-2.5 text-sm">
                      <Link to={`/admin/stock/${a.id}`} className="truncate hover:underline">{a.name}</Link>
                      <span className="shrink-0 tabular-nums text-orange-700">{a.quantity} / {a.min_quantity} {a.unit}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="flex items-center gap-1 border-t px-5 py-2 text-xs text-muted-foreground"><Package className="h-3.5 w-3.5" /> {data.stock.low_count} article(s) à réapprovisionner</p>
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}

function Kpi({ icon: Icon, label, value, previous, hint, tone }: { icon: typeof Receipt; label: string; value: number; previous?: number; hint?: string; tone?: "warning" }) {
  const delta = previous !== undefined && previous > 0 ? Math.round(((value - previous) / previous) * 100) : null;
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className={cn("h-4 w-4", tone === "warning" && "text-amber-600")} />{label}</div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{cfa(value)}</p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
        {delta !== null && (
          <span className={cn("inline-flex items-center gap-0.5 font-medium", delta >= 0 ? "text-emerald-700" : "text-red-700")}>
            {delta >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}{delta > 0 ? "+" : ""}{delta} %
          </span>
        )}
        {previous !== undefined && <span>période précédente {cfa(previous)}</span>}
        {hint && <span>{hint}</span>}
      </p>
    </div>
  );
}

/** Barres horizontales : libellé, barre proportionnelle, montant et part (texte en encre, la couleur ne porte que l'identité). */
function HBars({ rows, total }: { rows: { key: string; label: string; amount: number; color: string }[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.amount)));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.key} title={`${r.label} : ${cfa(r.amount)}`}>
          <div className="flex justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: r.color }} /><span className="truncate">{r.label}</span></span>
            <span className="shrink-0 tabular-nums">{cfa(r.amount)}{total > 0 && <span className="ml-1.5 text-xs text-muted-foreground">{Math.round((r.amount / total) * 100)} %</span>}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-muted">
            <div className="h-full rounded-full" style={{ width: `${Math.max(0, (r.amount / max) * 100)}%`, background: r.color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function MonthlyRevenue({ monthly, activities }: { monthly: Overview["revenue"]["monthly"]; activities: Option[] }) {
  const [table, setTable] = useState(false);
  // Activités sans aucun montant sur 12 mois : retirées (pas de série vide dans la légende).
  const shown = activities.filter((a) => monthly.some((m) => Number(m[a.value]) !== 0));
  return (
    <Panel title="Chiffre d'affaires HT sur 12 mois" action={<Button size="sm" variant="ghost" onClick={() => setTable(!table)}>{table ? "Graphique" : "Tableau"}</Button>}>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {shown.map((a) => <span key={a.value} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: ACTIVITY_COLORS[a.value] }} />{a.label}</span>)}
      </div>
      {table ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1.5 pr-3 font-medium">Mois</th>{shown.map((a) => <th key={a.value} className="py-1.5 pr-3 text-right font-medium">{a.label}</th>)}<th className="py-1.5 text-right font-medium">Total</th></tr></thead>
            <tbody>
              {monthly.map((m) => (
                <tr key={String(m.month)} className="border-t">
                  <td className="py-1.5 pr-3">{m.label}</td>
                  {shown.map((a) => <td key={a.value} className="py-1.5 pr-3 text-right tabular-nums">{cfa(Number(m[a.value]))}</td>)}
                  <td className="py-1.5 text-right font-medium tabular-nums">{cfa(shown.reduce((s, a) => s + Number(m[a.value]), 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#e7e5e0" />
              <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#d4d2cc" }} tick={{ fontSize: 11, fill: "#6b6a66" }} interval="preserveStartEnd" />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6b6a66" }} tickFormatter={compact} width={44} />
              <Tooltip cursor={{ fill: "rgba(0,0,0,0.04)" }} content={<RevenueTooltip activities={shown} />} />
              {shown.map((a, i) => (
                <Bar key={a.value} dataKey={a.value} name={a.label} stackId="ca" fill={ACTIVITY_COLORS[a.value]} maxBarSize={24}
                  stroke="#ffffff" strokeWidth={2} radius={i === shown.length - 1 ? [4, 4, 0, 0] : 0} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

function RevenueTooltip({ active, payload, label, activities }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string; activities: Option[] }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + Number(p.value), 0);
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      {activities.map((a) => {
        const v = payload.find((p) => p.dataKey === a.value)?.value ?? 0;
        return <p key={a.value} className="flex justify-between gap-4"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: ACTIVITY_COLORS[a.value] }} />{a.label}</span><span className="tabular-nums">{cfa(v)}</span></p>;
      })}
      <p className="mt-1 flex justify-between gap-4 border-t pt-1 font-medium"><span>Total</span><span className="tabular-nums">{cfa(total)}</span></p>
    </div>
  );
}
