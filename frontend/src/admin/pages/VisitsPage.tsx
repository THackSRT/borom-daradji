import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { addWeeks, endOfWeek, format, isSameDay, parseISO, startOfWeek } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import type { Visit } from "../types";
import { VisitReportDialog } from "../components/VisitDialogs";
import { EmptyState, LoadingBlock, PageHeader, StatusBadge, WhatsAppLink } from "../components/ui";

export default function VisitsPage() {
  const [week, setWeek] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [mine, setMine] = useState(true);
  const [reporting, setReporting] = useState<Visit | null>(null);

  const from = format(week, "yyyy-MM-dd");
  const to = format(endOfWeek(week, { weekStartsOn: 1 }), "yyyy-MM-dd");
  const { data, isLoading } = useQuery({
    queryKey: ["visits", { from, to, mine }],
    queryFn: () => api<{ data: Visit[] }>("/visits", { query: { from, to, mine: mine || undefined } }).then((r) => r.data),
  });

  const days = Array.from({ length: 7 }, (_, i) => new Date(week.getTime() + i * 86_400_000));

  return (
    <>
      <PageHeader
        title="Visites"
        description="Planning de la semaine. Une visite s'organise depuis la fiche du client."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setWeek(addWeeks(week, -1))} aria-label="Semaine précédente"><ChevronLeft className="h-4 w-4" /></Button>
            <span className="min-w-44 text-center text-sm font-medium">Semaine du {format(week, "d MMMM", { locale: fr })}</span>
            <Button variant="outline" size="icon" onClick={() => setWeek(addWeeks(week, 1))} aria-label="Semaine suivante"><ChevronRight className="h-4 w-4" /></Button>
          </div>
        }
      />
      <label className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Checkbox checked={mine} onCheckedChange={(v) => setMine(v === true)} /> Mes visites seulement
      </label>

      {isLoading ? <LoadingBlock /> : !data?.length ? <EmptyState>Aucune visite cette semaine.</EmptyState> : (
        <div className="space-y-6">
          {days.map((day) => {
            const visits = data.filter((v) => isSameDay(parseISO(v.scheduled_at), day));
            if (!visits.length) return null;
            return (
              <section key={day.toISOString()}>
                <h2 className="mb-2 text-sm font-semibold text-muted-foreground first-letter:uppercase">{format(day, "EEEE d MMMM", { locale: fr })}</h2>
                <div className="space-y-2">
                  {visits.map((v) => (
                    <Card key={v.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                      <span className="w-14 font-mono text-lg font-semibold">{format(parseISO(v.scheduled_at), "HH:mm")}</span>
                      <div className="flex-1 text-sm">
                        <p className="font-medium">
                          {v.client && <Link to={`/admin/clients/${v.client.id}`} className="hover:underline">{v.client.name}</Link>}
                          {" · "}
                          {v.property && <Link to={`/admin/biens/${v.property.id}`} className="text-primary hover:underline">{v.property.reference}</Link>}
                        </p>
                        <p className="text-muted-foreground">{v.property?.title}{v.property?.neighborhood && `, ${v.property.neighborhood}`}{!mine && v.agent && ` · ${v.agent.name}`}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge option={v.status} />
                        {v.status.value === "planifiee" && <WhatsAppLink url={v.client?.whatsapp_url} label="Confirmer" />}
                        <Button size="sm" variant="outline" onClick={() => setReporting(v)}>{v.status.value === "planifiee" ? "Compte-rendu" : "Modifier"}</Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {reporting && <VisitReportDialog visit={reporting} onClose={() => setReporting(null)} />}
    </>
  );
}
