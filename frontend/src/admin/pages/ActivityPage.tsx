import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { ActivityLog, Paginated } from "../types";
import { EmptyState, LoadingBlock, PageHeader, Pagination } from "../components/ui";

const actions: Record<string, string> = {
  created: "Création",
  updated: "Modification",
  deleted: "Suppression",
  login: "Connexion",
  logout: "Déconnexion",
  downloaded: "Téléchargement",
};

const subjects: Record<string, string> = {
  user: "Compte",
  company_settings: "Paramètres",
  client: "Client",
  client_document: "Pièce client",
  search_criterion: "Critères",
  property: "Bien",
  property_document: "Pièce de bien",
  property_check: "Vérification foncière",
  mandate: "Mandat",
  interaction: "Échange",
  visit: "Visite",
  task: "Tâche",
};

function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "∅";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function ActivityPage() {
  const [action, setAction] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const query = { action: action === "all" ? undefined : action, from, to, page };
  const { data, isLoading } = useQuery({
    queryKey: ["activity", query],
    queryFn: () => api<Paginated<ActivityLog>>("/activity-logs", { query }),
  });

  return (
    <>
      <PageHeader title="Journal d'activité" description="Qui a fait quoi, et quand. Conservé un an." />

      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={action} onValueChange={(v) => { setAction(v); setPage(1); }}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les actions</SelectItem>
            {Object.entries(actions).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" className="w-44" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} aria-label="Du" />
        <Input type="date" className="w-44" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} aria-label="Au" />
      </div>

      {isLoading ? <LoadingBlock /> : !data?.data.length ? <EmptyState>Aucune entrée.</EmptyState> : (
        <Card className="divide-y">
          {data.data.map((log) => (
            <div key={log.id} className="p-4 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p>
                  <span className="font-medium">{log.user?.name ?? "Système"}</span>{" "}
                  <span className="text-muted-foreground">· {actions[log.action] ?? log.action}</span>
                  {log.subject_type && (
                    <span className="text-muted-foreground"> · {subjects[log.subject_type] ?? log.subject_type} n° {log.subject_id}</span>
                  )}
                </p>
                <span className="text-xs text-muted-foreground">{formatDateTime(log.created_at)}{log.ip_address && ` · ${log.ip_address}`}</span>
              </div>
              {log.description && <p className="mt-1 text-muted-foreground">{log.description}</p>}
              {log.changes && log.action === "updated" && (
                <ul className="mt-2 space-y-0.5 text-xs">
                  {Object.entries(log.changes).map(([field, change]) => (
                    <li key={field}>
                      <span className="font-mono text-muted-foreground">{field}</span> : <span className="line-through opacity-60">{display(change.old)}</span> → {display(change.new)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </Card>
      )}
      {data && <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} onChange={setPage} />}
    </>
  );
}
