import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { CalendarDays, FileDown, HardHat, MessageCircle, Phone } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { SiteProvider, useSiteData } from "@/components/site/SiteProvider";
import { api, API_URL } from "@/lib/api";
import { formatDate, formatDateTime, formatPrice } from "@/lib/format";
import { formatPhone, whatsappLink } from "@/lib/public";
import { initials } from "@/lib/site";
import { cn } from "@/lib/utils";

interface Tracking {
  reference: string;
  title: string;
  address: string | null;
  client_name: string;
  status: { value: string; label: string };
  progress: number;
  manager: string | null;
  start_date: string | null;
  planned_end_date: string | null;
  actual_end_date: string | null;
  lots: { id: number; title: string; progress: number }[];
  logs: { id: number; logged_on: string; kind: string; body: string }[];
  photos: { id: number; caption: string | null; taken_at: string; lot_id: number | null; url: string }[];
  billing: {
    contract_total: number;
    invoiced_total: number;
    paid_total: number;
    balance: number;
    invoices: { id: number; label: string; number: string | null; issue_date: string | null; due_date: string | null; total: number; paid_total: number; balance: number; pdf_url: string }[];
  };
}

const statusTone: Record<string, string> = {
  planifie: "bg-blue-100 text-blue-800",
  en_cours: "bg-amber-100 text-amber-800",
  suspendu: "bg-orange-100 text-orange-800",
  termine: "bg-emerald-100 text-emerald-800",
  facture: "bg-emerald-100 text-emerald-800",
};

/**
 * Suivi d'un chantier par le client, sans compte (lien envoyé par l'agence, souvent par WhatsApp à un
 * client de la diaspora) : avancement, photos, journal, factures et paiements. Lecture seule.
 */
export default function TrackingPage() {
  return (
    <SiteProvider>
      <Tracking />
    </SiteProvider>
  );
}

function Tracking() {
  const { token } = useParams();
  const { company } = useSiteData();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["tracking", token],
    queryFn: () => api<{ data: Tracking }>(`/public/worksites/${token}`).then((r) => r.data),
    retry: false,
  });
  const whatsapp = whatsappLink(company.whatsapp ?? company.phone, data ? `Bonjour, je vous écris au sujet du chantier ${data.reference} (${data.title}).` : "");

  return (
    <div className="min-h-screen bg-muted/30">
      <Helmet>
        <title>{data ? `Suivi — ${data.title}` : "Suivi de chantier"}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {company.logo_url
              ? <img src={company.logo_url} alt="" className="h-9 w-9 rounded object-contain" />
              : <span className="flex h-9 w-9 items-center justify-center rounded bg-primary text-sm font-bold text-primary-foreground">{initials(company.trade_name)}</span>}
            <div className="min-w-0">
              <p className="truncate font-semibold">{company.trade_name}</p>
              <p className="text-xs text-muted-foreground">Suivi de chantier</p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            {company.phone && <a href={`tel:${company.phone}`} className="flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-muted" aria-label="Appeler"><Phone className="h-4 w-4" /><span className="hidden sm:inline">{formatPhone(company.phone)}</span></a>}
            {whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer" className="flex h-9 items-center gap-1.5 rounded-md bg-[#25D366] px-3 text-sm font-medium text-white hover:opacity-90"><MessageCircle className="h-4 w-4" /><span className="hidden sm:inline">WhatsApp</span></a>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6">
        {isLoading ? (
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        ) : isError || !data ? (
          <section className="rounded-xl border bg-background p-8 text-center">
            <HardHat className="mx-auto h-10 w-10 text-muted-foreground" />
            <h1 className="mt-3 text-lg font-semibold">Lien de suivi invalide</h1>
            <p className="mt-1 text-sm text-muted-foreground">Ce lien a expiré ou a été remplacé. Demandez le nouveau lien à {company.trade_name}.</p>
          </section>
        ) : (
          <TrackingContent data={data} />
        )}
      </main>
    </div>
  );
}

function TrackingContent({ data }: { data: Tracking }) {
  const [photo, setPhoto] = useState<Tracking["photos"][number] | null>(null);
  const end = data.actual_end_date ? `Terminé le ${formatDate(data.actual_end_date)}` : data.planned_end_date ? `Fin prévue le ${formatDate(data.planned_end_date)}` : null;
  const b = data.billing;

  return (
    <>
      <section className="rounded-xl border bg-background p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold sm:text-2xl">{data.title}</h1>
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", statusTone[data.status.value] ?? "bg-muted")}>{data.status.label}</span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{data.reference} · {data.client_name}{data.address && ` · ${data.address}`}</p>
        <div className="mt-5 flex items-end justify-between gap-3">
          <span className="text-sm font-medium">Avancement global</span>
          <span className="text-3xl font-semibold tabular-nums">{data.progress} %</span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${data.progress}%` }} /></div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          {data.start_date && <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />Début le {formatDate(data.start_date)}</span>}
          {end && <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{end}</span>}
          {data.manager && <span className="flex items-center gap-1.5"><HardHat className="h-4 w-4" />Chef de chantier : {data.manager}</span>}
        </div>
      </section>

      {data.lots.length > 0 && (
        <section className="rounded-xl border bg-background p-5">
          <h2 className="mb-4 font-semibold">Avancement par étape</h2>
          <ul className="space-y-3">
            {data.lots.map((l) => (
              <li key={l.id}>
                <div className="flex justify-between text-sm"><span>{l.title}</span><span className="tabular-nums text-muted-foreground">{l.progress} %</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", l.progress === 100 ? "bg-emerald-500" : "bg-primary")} style={{ width: `${l.progress}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.photos.length > 0 && (
        <section className="rounded-xl border bg-background p-5">
          <h2 className="mb-4 font-semibold">Photos ({data.photos.length})</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {data.photos.map((p) => (
              <button key={p.id} type="button" onClick={() => setPhoto(p)} className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
                <img src={`${API_URL}${p.url}`} alt={p.caption ?? ""} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 px-2 pb-1.5 pt-4 text-left text-[11px] text-white">{formatDate(p.taken_at)}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border bg-background p-5">
        <h2 className="mb-4 font-semibold">Paiements</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Amount label="Montant des travaux" value={b.contract_total} />
          <Amount label="Payé" value={b.paid_total} tone="text-emerald-700" />
          <Amount label="Reste à régler (factures émises)" value={b.balance} tone={b.balance > 0 ? "text-red-600" : undefined} />
        </div>
        {b.invoices.length > 0 ? (
          <ul className="mt-4 divide-y rounded-lg border">
            {b.invoices.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{i.label} <span className="font-normal text-muted-foreground">{i.number}</span></p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(i.issue_date)} · {formatPrice(i.total)}
                    {i.balance > 0 ? <span className="text-red-600"> · reste {formatPrice(i.balance)}{i.due_date && ` avant le ${formatDate(i.due_date)}`}</span> : <span className="text-emerald-700"> · réglée</span>}
                  </p>
                </div>
                <a href={`${API_URL}${i.pdf_url}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-muted"><FileDown className="h-3.5 w-3.5" /> PDF</a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Aucune facture pour l'instant.</p>
        )}
      </section>

      {data.logs.length > 0 && (
        <section className="rounded-xl border bg-background p-5">
          <h2 className="mb-4 font-semibold">Journal du chantier</h2>
          <ol className="relative space-y-4 border-l pl-5">
            {data.logs.map((l) => (
              <li key={l.id} className="relative">
                <span className={cn("absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-background", l.kind === "note" ? "bg-primary" : "bg-muted-foreground")} />
                <p className="text-xs text-muted-foreground">{formatDate(l.logged_on)}</p>
                <p className="whitespace-pre-line text-sm">{l.body}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <p className="pb-6 text-center text-xs text-muted-foreground">Page mise à jour en temps réel par l'équipe du chantier. Ne transférez ce lien qu'aux personnes de confiance.</p>

      {photo && (
        <Dialog open onOpenChange={(o) => !o && setPhoto(null)}>
          <DialogContent className="max-w-3xl p-2">
            <DialogTitle className="sr-only">{photo.caption ?? "Photo du chantier"}</DialogTitle>
            <img src={`${API_URL}${photo.url}`} alt={photo.caption ?? ""} className="max-h-[80vh] w-full rounded object-contain" />
            <p className="px-2 pb-1 text-sm">{photo.caption && <span className="font-medium">{photo.caption} · </span>}<span className="text-muted-foreground">{formatDateTime(photo.taken_at)}</span></p>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function Amount({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-lg font-semibold tabular-nums", tone)}>{formatPrice(value)}</p>
    </div>
  );
}
