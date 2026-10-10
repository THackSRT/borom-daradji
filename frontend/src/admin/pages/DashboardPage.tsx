import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { AlertTriangle, ArrowRight, Building2, CalendarDays, ClipboardList, Home, Sparkles, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { fromNow } from "@/lib/format";
import { useAuth } from "../auth";
import type { Dashboard } from "../types";
import { TaskItem } from "../components/TaskItem";
import { useQuickCreate } from "../components/QuickCreate";
import { Avatar, EmptyState, Panel, ProgressBar, StatCard, WhatsAppLink } from "../components/ui";

export default function DashboardPage() {
  const { user, hasRole, isDirigeant } = useAuth();
  const navigate = useNavigate();
  const quickCreate = useQuickCreate();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<{ data: Dashboard }>("/dashboard").then((r) => r.data),
    refetchInterval: 60_000,
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";
  const k = data?.kpis;

  return (
    <>
      <div className="mb-6">
        <p className="text-sm text-muted-foreground first-letter:uppercase">{format(new Date(), "EEEE d MMMM", { locale: fr })}</p>
        <h1 className="text-2xl font-semibold tracking-tight md:text-[1.75rem]">{greeting} {user?.name.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isDirigeant ? "Voici l'activité de toute l'agence." : "Voici ce qui vous attend aujourd'hui."}
        </p>
      </div>

      {isLoading || !k ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatCard icon={ClipboardList} label="Tâches pour aujourd'hui" value={k.tasks_today}
            hint={k.tasks_overdue ? `dont ${k.tasks_overdue} en retard` : "Rien en retard"} tone={k.tasks_overdue ? "danger" : "default"}
            onClick={() => navigate("/admin/taches")} />
          <StatCard icon={CalendarDays} label="Visites aujourd'hui" value={k.visits_today} hint={`${k.visits_week} cette semaine`}
            onClick={hasRole("agent", "commercial") ? () => navigate("/admin/visites") : undefined} />
          <StatCard icon={UserPlus} label="Prospects à contacter" value={k.new_leads} hint={`${k.leads_this_week} nouveaux en 7 jours`}
            tone={k.new_leads ? "warning" : "default"} onClick={() => navigate("/admin/clients?etape=nouveau")} />
          <StatCard icon={Building2} label="Biens en ligne" value={k.published} hint={k.drafts ? `${k.drafts} en attente de vérification` : "Aucun brouillon"}
            tone="success" onClick={() => navigate("/admin/biens")} />
        </div>
      )}

      {k && k.mandates_expiring > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {k.mandates_expiring} mandat{k.mandates_expiring > 1 ? "s expirent" : " expire"} dans les 30 prochains jours. Pensez au renouvellement.
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <Panel
            title="À faire aujourd'hui"
            description="Cochez pour terminer, « Demain » pour reporter."
            action={<Button variant="ghost" size="sm" asChild><Link to="/admin/taches">Tout voir <ArrowRight className="h-4 w-4" /></Link></Button>}
            bodyClassName="p-2"
          >
            {isLoading ? <div className="p-3"><Skeleton className="h-12" /></div> : !data?.tasks.length ? (
              <EmptyState icon={Sparkles} title="Tout est à jour" compact
                action={<Button size="sm" variant="outline" onClick={() => quickCreate.open("task")}>Ajouter une tâche</Button>}>
                Aucune tâche à échéance aujourd'hui.
              </EmptyState>
            ) : (
              <div className="divide-y">{data.tasks.map((t) => <TaskItem key={t.id} task={t} />)}</div>
            )}
          </Panel>

          {hasRole("agent") && (
            <Panel title="Biens en attente de publication" description="Terminez la vérification foncière pour les mettre en ligne."
              action={<Button variant="ghost" size="sm" asChild><Link to="/admin/biens?statut=brouillon">Voir <ArrowRight className="h-4 w-4" /></Link></Button>}
              bodyClassName="p-2">
              {!data?.drafts.length ? (
                <EmptyState icon={Building2} title="Aucun brouillon" compact>Tous vos biens sont vérifiés.</EmptyState>
              ) : (
                <div className="divide-y">
                  {data.drafts.map((p) => (
                    <Link key={p.id} to={`/admin/biens/${p.id}`} className="flex items-center gap-3 rounded-lg px-3 py-3 transition hover:bg-muted/50">
                      <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                        {p.cover_url ? <img src={p.cover_url} alt="" className="h-full w-full object-cover" /> : <Home className="h-5 w-5 text-muted-foreground" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.title}</p>
                        <p className="font-mono text-xs text-muted-foreground">{p.reference}</p>
                      </div>
                      {p.checks_progress && <ProgressBar className="w-36" value={p.checks_progress.cleared} total={p.checks_progress.total} />}
                    </Link>
                  ))}
                </div>
              )}
            </Panel>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <Panel title="Visites du jour" bodyClassName="p-2">
            {!data?.visits_today.length ? (
              <EmptyState icon={CalendarDays} compact>Pas de visite prévue aujourd'hui.</EmptyState>
            ) : (
              <ol className="relative ml-3 border-l py-2">
                {data.visits_today.map((v) => (
                  <li key={v.id} className="relative mb-3 ml-4 last:mb-0">
                    <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-primary" />
                    <p className="text-xs font-semibold tabular-nums text-primary">{format(new Date(v.scheduled_at), "HH:mm")}</p>
                    <p className="text-sm font-medium">{v.client?.name}</p>
                    <p className="text-xs text-muted-foreground">{v.property?.reference} · {v.property?.neighborhood}</p>
                    {v.status.value === "planifiee" && <div className="mt-1"><WhatsAppLink url={v.client?.whatsapp_url} label="Confirmer" /></div>}
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel title="Nouveaux prospects" description="Demandes du site et contacts à rappeler."
            action={<Button variant="ghost" size="sm" asChild><Link to="/admin/clients?etape=nouveau"><ArrowRight className="h-4 w-4" /></Link></Button>}
            bodyClassName="p-2">
            {!data?.new_leads.length ? (
              <EmptyState icon={UserPlus} compact>Aucun prospect en attente.</EmptyState>
            ) : (
              <div className="divide-y">
                {data.new_leads.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                    <Avatar name={c.name} size="sm" />
                    <Link to={`/admin/clients/${c.id}`} className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium hover:text-primary">{c.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.source?.label ?? "—"} · {fromNow(c.created_at)}</p>
                    </Link>
                    <WhatsAppLink url={c.whatsapp_url} size="icon" />
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
