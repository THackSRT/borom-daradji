import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Copy, Download, HardHat, Pencil, RotateCcw, Save, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api, downloadFile } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/format";
import { useAuth } from "../auth";
import { useApiMutation } from "../hooks";
import type { Paginated, Quote, Worksite } from "../types";
import { AmountRow, cfa } from "../components/billing";
import { EmptyState, Field, FormError, LoadingBlock, Panel, StatusBadge, WhatsAppLink } from "../components/ui";

const qty = (v: number) => v.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

export default function QuoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [dialog, setDialog] = useState<"accept" | "refuse" | "template" | "delete" | null>(null);
  const { data: quote, isLoading, isError } = useQuery({
    queryKey: ["quote", id],
    queryFn: () => api<{ data: Quote }>(`/quotes/${id}`).then((r) => r.data),
  });
  const invalidate = [["quote", id], ["quotes"]];
  const send = useApiMutation(() => api(`/quotes/${id}/send`, { method: "POST" }), { success: "Devis envoyé : transmettez le PDF au client.", invalidate });
  const reopen = useApiMutation(() => api(`/quotes/${id}/reopen`, { method: "POST" }), { success: "Devis repris en brouillon.", invalidate });
  const duplicate = useApiMutation(() => api<{ data: Quote }>("/quotes", { method: "POST", body: { source_id: Number(id) } }), {
    success: "Copie créée en brouillon.", invalidate: [["quotes"]], onSuccess: (r) => navigate(`/admin/devis/${r.data.id}/modifier`),
  });

  if (isLoading) return <LoadingBlock />;
  if (isError || !quote) return <EmptyState title="Devis introuvable" action={<Button asChild variant="outline"><Link to="/admin/devis">Retour aux devis</Link></Button>} />;

  const status = quote.status.value;
  const canAct = !!quote.can?.decide;
  const pdfName = `${quote.number ?? `modele-${quote.id}`}.pdf`;

  return (
    <>
      <Link to={quote.is_template ? "/admin/devis?filtre=modeles" : "/admin/devis"} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> {quote.is_template ? "Modèles" : "Devis"}</Link>

      <section className="mb-6 rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{quote.is_template ? quote.template_name ?? quote.title : quote.client?.name}</h1>
              {quote.is_template ? <StatusBadge option={{ value: "devis", label: "Modèle" }} /> : <StatusBadge option={quote.status} />}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {quote.number && <><span className="font-mono">{quote.number}</span> · </>}{quote.title}
              {quote.site_address && <> · {quote.site_address}</>}
            </p>
            {status === "envoye" && quote.valid_until && <p className="mt-1 text-sm text-muted-foreground">Envoyé le {formatDate(quote.issue_date)}, valable jusqu'au {formatDate(quote.valid_until)}.</p>}
            {status === "refuse" && <p className="mt-1 text-sm text-red-700">Refusé le {formatDateTime(quote.decided_at)} : {quote.refusal_reason}</p>}
            {status === "expire" && <p className="mt-1 text-sm text-red-700">Expiré le {formatDate(quote.valid_until)} : renvoyez-le pour une nouvelle validité.</p>}
            {quote.worksite && (
              <Link to={`/admin/chantiers/${quote.worksite.id}`} className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                <HardHat className="h-4 w-4" /> Chantier {quote.worksite.reference} · {quote.worksite.status.label}
              </Link>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => downloadFile(`/quotes/${quote.id}/pdf`, pdfName)}><Download className="h-4 w-4" /> PDF</Button>
            {status === "envoye" && <WhatsAppLink url={quote.whatsapp_url} label="Envoyer par WhatsApp" />}
            {quote.can?.update && <Button variant="outline" asChild><Link to={`/admin/devis/${quote.id}/modifier`}><Pencil className="h-4 w-4" /> Modifier</Link></Button>}
            {quote.is_template && can("works.quotes") && <Button asChild><Link to={`/admin/devis/nouveau?depuis=${quote.id}`}><Copy className="h-4 w-4" /> Utiliser pour un devis</Link></Button>}
            {canAct && (status === "brouillon" || status === "expire") && (
              <Button onClick={() => send.mutate(undefined)} disabled={send.isPending}><Send className="h-4 w-4" /> {status === "expire" ? "Renvoyer" : "Marquer envoyé"}</Button>
            )}
            {canAct && status === "envoye" && <Button onClick={() => setDialog("accept")}><Check className="h-4 w-4" /> Accepté</Button>}
            {canAct && (status === "envoye" || status === "expire") && <Button variant="outline" onClick={() => setDialog("refuse")}><X className="h-4 w-4" /> Refusé</Button>}
            {canAct && (status === "envoye" || status === "expire") && <Button variant="ghost" onClick={() => reopen.mutate(undefined)}><RotateCcw className="h-4 w-4" /> Reprendre en brouillon</Button>}
            {!quote.is_template && can("works.quotes") && <Button variant="ghost" onClick={() => duplicate.mutate(undefined)} disabled={duplicate.isPending}><Copy className="h-4 w-4" /> Dupliquer</Button>}
            {!quote.is_template && can("works.catalog") && <Button variant="ghost" onClick={() => setDialog("template")}><Save className="h-4 w-4" /> Enregistrer comme modèle</Button>}
            {quote.can?.delete && <Button variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => setDialog("delete")}><Trash2 className="h-4 w-4" /></Button>}
          </div>
        </div>
        <FormError message={send.error?.field("quote") ?? reopen.error?.field("quote")} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {(quote.lots ?? []).length === 0 && <Panel><p className="text-sm text-muted-foreground">Aucun lot : modifiez le devis pour ajouter des prestations.</p></Panel>}
          {(quote.lots ?? []).map((lot, i) => (
            <Panel key={lot.id} title={`Lot ${i + 1} — ${lot.title}`} action={<span className="text-sm font-semibold tabular-nums">{cfa(lot.total_ht ?? 0)} HT</span>} bodyClassName="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Désignation</TableHead>
                    <TableHead className="text-right">Quantité</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Prix unitaire</TableHead>
                    <TableHead className="text-right">Montant HT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lot.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="text-sm">{line.designation}</TableCell>
                      <TableCell className="whitespace-nowrap text-right text-sm tabular-nums">{qty(line.quantity)} {line.unit}</TableCell>
                      <TableCell className="hidden text-right text-sm tabular-nums sm:table-cell">{cfa(line.unit_price)}</TableCell>
                      <TableCell className="text-right text-sm tabular-nums">{cfa(line.amount ?? 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>
          ))}
        </div>
        <aside className="space-y-4">
          <Panel title="Totaux">
            {quote.discount_amount > 0 && <AmountRow label="Total HT avant remise" value={quote.subtotal} tone="muted" />}
            {quote.discount_amount > 0 && <AmountRow label={`Remise ${quote.discount_rate} %`} value={-quote.discount_amount} tone="muted" />}
            <AmountRow label="Total HT" value={quote.total_ht} />
            <AmountRow label="TVA" value={quote.vat_total} tone="muted" />
            <AmountRow label="Total TTC" value={quote.total} strong />
            {quote.deposit_rate > 0 && <p className="mt-1 text-xs text-muted-foreground">Acompte à la commande ({quote.deposit_rate} %) : {cfa(quote.deposit_amount)}</p>}
          </Panel>
          {quote.conditions && <Panel title="Conditions"><p className="whitespace-pre-line text-sm text-muted-foreground">{quote.conditions}</p></Panel>}
          {quote.notes && <Panel title="Notes internes"><p className="whitespace-pre-line text-sm">{quote.notes}</p></Panel>}
          {quote.creator && <p className="px-1 text-xs text-muted-foreground">Préparé par {quote.creator.name}, le {formatDate(quote.created_at)}.</p>}
        </aside>
      </div>

      {dialog === "accept" && <AcceptDialog quote={quote} onClose={() => setDialog(null)} />}
      {dialog === "refuse" && <RefuseDialog quote={quote} onClose={() => setDialog(null)} />}
      {dialog === "template" && <TemplateDialog quote={quote} onClose={() => setDialog(null)} />}
      {dialog === "delete" && <DeleteDialog quote={quote} onClose={() => setDialog(null)} />}
    </>
  );
}

function AcceptDialog({ quote, onClose }: { quote: Quote; onClose: () => void }) {
  const navigate = useNavigate();
  const [worksite, setWorksite] = useState("new");
  const { data: worksites = [] } = useQuery({
    queryKey: ["worksites", { client: quote.client?.id }],
    queryFn: () => api<Paginated<Worksite>>("/worksites", { query: { client_id: quote.client?.id, per_page: 50 } })
      .then((r) => r.data.filter((w) => ["devis", "planifie", "en_cours", "suspendu"].includes(w.status.value))),
  });
  const mutation = useApiMutation(() => api<{ data: Quote }>(`/quotes/${quote.id}/accept`, { method: "POST", body: { worksite_id: worksite === "new" ? null : Number(worksite) } }), {
    success: "Devis accepté : le chantier est prêt.", invalidate: [["quote", String(quote.id)], ["quotes"], ["worksites"]],
    onSuccess: (r) => { onClose(); if (r.data.worksite) navigate(`/admin/chantiers/${r.data.worksite.id}`); },
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Le client accepte le devis</DialogTitle>
          <DialogDescription>Le chantier reprend les lots du devis et son montant ({cfa(quote.total)} TTC) pour les acomptes et situations.</DialogDescription>
        </DialogHeader>
        <FormError message={mutation.error?.field("quote") ?? mutation.error?.field("worksite_id")} />
        {worksites.length > 0 && (
          <Field label="Chantier">
            <Select value={worksite} onValueChange={setWorksite}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Nouveau chantier</SelectItem>
                {worksites.map((w) => <SelectItem key={w.id} value={String(w.id)}>Ajouter au chantier {w.reference} · {w.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={() => mutation.mutate(undefined)} disabled={mutation.isPending}>Accepter et ouvrir le chantier</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RefuseDialog({ quote, onClose }: { quote: Quote; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const mutation = useApiMutation(() => api(`/quotes/${quote.id}/refuse`, { method: "POST", body: { reason } }), {
    success: "Devis marqué refusé.", invalidate: [["quote", String(quote.id)], ["quotes"]], onSuccess: onClose,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Le client refuse le devis</DialogTitle><DialogDescription>Le motif aide à ajuster les prochains devis.</DialogDescription></DialogHeader>
        <Field label="Motif" htmlFor="refuse-reason" error={mutation.error?.field("reason")}>
          <Textarea id="refuse-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. trop cher, a choisi un autre artisan, projet reporté" />
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="destructive" onClick={() => mutation.mutate(undefined)} disabled={mutation.isPending}>Marquer refusé</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplateDialog({ quote, onClose }: { quote: Quote; onClose: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState(quote.title);
  const mutation = useApiMutation(() => api<{ data: Quote }>("/quotes", { method: "POST", body: { source_id: quote.id, is_template: true, template_name: name } }), {
    success: "Modèle enregistré.", invalidate: [["quotes"]], onSuccess: (r) => navigate(`/admin/devis/${r.data.id}`),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Enregistrer comme modèle</DialogTitle><DialogDescription>Les lots, lignes, remise et conditions sont copiés, sans le client.</DialogDescription></DialogHeader>
        <Field label="Nom du modèle" htmlFor="tpl-name" error={mutation.error?.field("template_name")}>
          <Input id="tpl-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={() => mutation.mutate(undefined)} disabled={mutation.isPending || !name}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ quote, onClose }: { quote: Quote; onClose: () => void }) {
  const navigate = useNavigate();
  const mutation = useApiMutation(() => api(`/quotes/${quote.id}`, { method: "DELETE" }), {
    success: quote.is_template ? "Modèle supprimé." : "Brouillon supprimé.", invalidate: [["quotes"]],
    onSuccess: () => navigate(quote.is_template ? "/admin/devis?filtre=modeles" : "/admin/devis"),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Supprimer {quote.is_template ? "ce modèle" : "ce brouillon"} ?</DialogTitle></DialogHeader>
        <FormError message={mutation.error?.field("quote")} />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button variant="destructive" onClick={() => mutation.mutate(undefined)} disabled={mutation.isPending}>Supprimer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
