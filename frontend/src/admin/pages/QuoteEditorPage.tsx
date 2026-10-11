import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowLeft, ArrowUp, BookOpen, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useApiMutation } from "../hooks";
import type { CatalogItem, Client, CompanySettings, Paginated, Property, Quote, Trade } from "../types";
import { AmountRow, cfa, computeLine, EntityPicker, MoneyInput, type PickerItem } from "../components/billing";
import { Field, FormError, LoadingBlock, PageHeader, Panel } from "../components/ui";

type DraftLine = { key: number; catalog_item_id: number | null; designation: string; unit: string; quantity: number; unit_price: number | ""; vat_rate: number };
type DraftLot = { key: number; title: string; trade_id: number | null; lines: DraftLine[] };

let nextKey = 1;
const searchClients = (term: string) =>
  api<Paginated<Client>>("/clients", { query: { search: term, per_page: 10 } })
    .then((r) => r.data.map((c) => ({ id: c.id, label: c.name, hint: c.phone ?? undefined })));
const searchProperties = (term: string) =>
  api<Paginated<Property>>("/properties", { query: { search: term, per_page: 10 } })
    .then((r) => r.data.map((p) => ({ id: p.id, label: `${p.reference} · ${p.title}` })));

/** Même calcul que App\Services\QuoteService : remise ligne par ligne, puis TVA sur le montant remisé. */
function lineTotals(line: DraftLine, discount: number) {
  const { amount } = computeLine({ quantity: line.quantity, unit_price: Number(line.unit_price || 0), vat_rate: 0 });
  const net = Math.round((amount * (10000 - Math.round(discount * 100))) / 10000);
  const vat = Math.round((net * Math.round(line.vat_rate * 100)) / 10000);
  return { amount, net, vat };
}

const toDraftLots = (quote: Pick<Quote, "lots">): DraftLot[] =>
  (quote.lots ?? []).map((lot) => ({
    key: nextKey++, title: lot.title, trade_id: lot.trade_id,
    lines: lot.lines.map((l) => ({ key: nextKey++, catalog_item_id: l.catalog_item_id, designation: l.designation, unit: l.unit ?? "", quantity: l.quantity, unit_price: l.unit_price, vat_rate: l.vat_rate })),
  }));

/**
 * Création et modification d'un devis ou d'un modèle, par lots. Les totaux affichés suivent les mêmes
 * arrondis que le serveur, qui recalcule tout à l'enregistrement.
 */
export default function QuoteEditorPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const editing = !!id;

  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: () => api<{ data: CompanySettings }>("/settings/company").then((r) => r.data) });
  const defaultVat = settings?.vat_rate ?? 18;
  const { data: trades = [] } = useQuery({ queryKey: ["trades"], queryFn: () => api<{ data: Trade[] }>("/trades").then((r) => r.data) });
  const { data: quote, isLoading } = useQuery({
    queryKey: ["quote", id],
    queryFn: () => api<{ data: Quote }>(`/quotes/${id}`).then((r) => r.data),
    enabled: editing,
  });
  const { data: templates = [] } = useQuery({
    queryKey: ["quotes", { templates: 1, picker: true }],
    queryFn: () => api<Paginated<Quote>>("/quotes", { query: { templates: 1, per_page: 100 } }).then((r) => r.data),
    enabled: !editing,
  });

  const [isTemplate, setIsTemplate] = useState(params.get("modele") === "1");
  const [templateName, setTemplateName] = useState("");
  const [client, setClient] = useState<PickerItem | null>(null);
  const [property, setProperty] = useState<PickerItem | null>(null);
  const [title, setTitle] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [discount, setDiscount] = useState(0);
  const [deposit, setDeposit] = useState<number | null>(null);
  const [conditions, setConditions] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [lots, setLots] = useState<DraftLot[]>([]);

  useEffect(() => {
    if (!quote) return;
    setIsTemplate(quote.is_template);
    setTemplateName(quote.template_name ?? "");
    setClient(quote.client ? { id: quote.client.id, label: quote.client.name } : null);
    setProperty(quote.property ? { id: quote.property.id, label: `${quote.property.reference} · ${quote.property.title}` } : null);
    setTitle(quote.title);
    setSiteAddress(quote.site_address ?? "");
    setDiscount(quote.discount_rate);
    setDeposit(quote.deposit_rate);
    setConditions(quote.conditions);
    setNotes(quote.notes ?? "");
    setLots(toDraftLots(quote));
  }, [quote]);
  useEffect(() => {
    const clientId = params.get("client");
    const clientName = params.get("nom");
    if (!editing && clientId && clientName) setClient({ id: Number(clientId), label: clientName });
  }, [editing, params]);

  // « Utiliser pour un devis » depuis la fiche d'un modèle.
  const fromTemplate = params.get("depuis");
  useEffect(() => {
    if (!editing && fromTemplate) applyTemplate(fromTemplate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, fromTemplate]);

  const applyTemplate = async (templateId: string) => {
    const t = await api<{ data: Quote }>(`/quotes/${templateId}`).then((r) => r.data);
    if (!title) setTitle(t.title);
    setDiscount(t.discount_rate);
    setDeposit(t.deposit_rate);
    setConditions(t.conditions);
    setLots(toDraftLots(t));
  };

  const totals = useMemo(() => {
    let subtotal = 0, net = 0, vat = 0;
    const byLot = lots.map((lot) => lot.lines.reduce((sum, line) => {
      const t = lineTotals(line, discount);
      subtotal += t.amount; net += t.net; vat += t.vat;
      return sum + t.net;
    }, 0));
    return { subtotal, discountAmount: subtotal - net, net, vat, total: net + vat, byLot };
  }, [lots, discount]);

  const updateLot = (key: number, patch: Partial<DraftLot>) => setLots((all) => all.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const moveLot = (index: number, dir: -1 | 1) => setLots((all) => {
    const next = [...all];
    const [lot] = next.splice(index, 1);
    next.splice(index + dir, 0, lot);
    return next;
  });
  const addLot = (tradeId: number | null) => {
    const trade = trades.find((t) => t.id === tradeId);
    setLots((all) => [...all, { key: nextKey++, title: trade?.name ?? "Nouveau lot", trade_id: tradeId, lines: [] }]);
  };

  const mutation = useApiMutation(() => {
    const body = {
      is_template: isTemplate,
      template_name: isTemplate ? templateName || title : null,
      client_id: isTemplate ? null : client?.id ?? null,
      property_id: isTemplate ? null : property?.id ?? null,
      title,
      site_address: isTemplate ? null : siteAddress || null,
      discount_rate: discount,
      ...(deposit !== null ? { deposit_rate: deposit } : {}),
      ...(conditions !== null ? { conditions } : {}),
      notes: notes || null,
      lots: lots.map((lot) => ({
        title: lot.title,
        trade_id: lot.trade_id,
        lines: lot.lines.map((l) => ({ catalog_item_id: l.catalog_item_id, designation: l.designation, unit: l.unit || null, quantity: l.quantity, unit_price: Number(l.unit_price || 0), vat_rate: l.vat_rate })),
      })),
    };
    return editing
      ? api<{ data: Quote }>(`/quotes/${id}`, { method: "PUT", body })
      : api<{ data: Quote }>("/quotes", { method: "POST", body });
  }, {
    success: isTemplate ? "Modèle enregistré." : "Devis enregistré.",
    invalidate: [["quotes"], ["quote", id]],
    onSuccess: (r) => navigate(`/admin/devis/${r.data.id}`),
  });
  const err = (f: string) => mutation.error?.field(f);
  const submit = (e: FormEvent) => { e.preventDefault(); mutation.mutate(undefined); };

  if (editing && isLoading) return <LoadingBlock />;

  return (
    <form onSubmit={submit}>
      <Link to={editing ? `/admin/devis/${id}` : "/admin/devis"} className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> {editing ? "Retour au devis" : "Devis"}</Link>
      <PageHeader
        title={isTemplate ? (editing ? "Modifier le modèle" : "Nouveau modèle de devis") : editing ? `Modifier ${quote?.number ?? "le devis"}` : "Nouveau devis"}
        description="Un lot par corps de métier ; chaque ligne vient du catalogue ou se saisit librement."
        actions={<Button type="submit" disabled={mutation.isPending}>Enregistrer</Button>}
      />
      <FormError message={err("quote")} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <Panel title={isTemplate ? "Modèle" : "Client et objet"}>
            <div className="grid gap-4 sm:grid-cols-2">
              {isTemplate ? (
                <Field label="Nom du modèle" htmlFor="q-template" error={err("template_name")}>
                  <Input id="q-template" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Ex. Salle de bain standard" />
                </Field>
              ) : (
                <Field label="Client" error={err("client_id")}>
                  <EntityPicker value={client} onChange={setClient} search={searchClients} placeholder="Choisir le client" queryKey="clients" />
                </Field>
              )}
              <Field label="Objet du devis" htmlFor="q-title" error={err("title")}>
                <Input id="q-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Rénovation de la salle de bain" />
              </Field>
              {!isTemplate && (
                <>
                  <Field label="Lieu des travaux" htmlFor="q-address" error={err("site_address")}>
                    <Input id="q-address" value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} placeholder="Quartier, rue, repère" />
                  </Field>
                  <Field label="Bien de l'agence (facultatif)" error={err("property_id")}>
                    <EntityPicker value={property} onChange={setProperty} search={searchProperties} placeholder="Aucun" queryKey="properties" allowClear />
                  </Field>
                </>
              )}
              {!editing && !isTemplate && templates.length > 0 && (
                <Field label="Partir d'un modèle" className="sm:col-span-2">
                  <Select onValueChange={applyTemplate}>
                    <SelectTrigger><SelectValue placeholder="Aucun : devis vierge" /></SelectTrigger>
                    <SelectContent>{templates.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.template_name ?? t.title} · {cfa(t.total)}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              )}
            </div>
          </Panel>

          {lots.map((lot, lotIndex) => (
            <Panel key={lot.key} bodyClassName="space-y-3 p-4 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <Field label={`Lot ${lotIndex + 1}`} className="flex-1" error={err(`lots.${lotIndex}.title`)}>
                  <Input value={lot.title} onChange={(e) => updateLot(lot.key, { title: e.target.value })} />
                </Field>
                <Field label="Corps de métier" className="sm:w-60">
                  <Select value={lot.trade_id ? String(lot.trade_id) : "none"} onValueChange={(v) => updateLot(lot.key, { trade_id: v === "none" ? null : Number(v) })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {trades.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="icon" disabled={lotIndex === 0} onClick={() => moveLot(lotIndex, -1)} aria-label="Monter le lot"><ArrowUp className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" disabled={lotIndex === lots.length - 1} onClick={() => moveLot(lotIndex, 1)} aria-label="Descendre le lot"><ArrowDown className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setLots(lots.filter((l) => l.key !== lot.key))} aria-label="Supprimer le lot"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>

              <div className="space-y-2">
                {lot.lines.map((line, lineIndex) => {
                  const t = lineTotals(line, discount);
                  const setLine = (patch: Partial<DraftLine>) => updateLot(lot.key, { lines: lot.lines.map((l) => (l.key === line.key ? { ...l, ...patch } : l)) });
                  const prefix = `lots.${lotIndex}.lines.${lineIndex}`;
                  return (
                    <div key={line.key} className="grid grid-cols-12 gap-x-2 gap-y-1.5 rounded-lg border p-2.5">
                      <div className="col-span-11">
                        <Input value={line.designation} onChange={(e) => setLine({ designation: e.target.value })} placeholder="Désignation" aria-label="Désignation" />
                        {err(`${prefix}.designation`) && <p className="mt-1 text-xs text-destructive">{err(`${prefix}.designation`)}</p>}
                      </div>
                      <Button type="button" variant="ghost" size="icon" className="col-span-1 justify-self-end" onClick={() => updateLot(lot.key, { lines: lot.lines.filter((l) => l.key !== line.key) })} aria-label="Supprimer la ligne"><Trash2 className="h-4 w-4" /></Button>
                      <LineField label="Quantité" className="col-span-4 sm:col-span-2">
                        <Input type="number" step="0.01" min="0" value={line.quantity} onChange={(e) => setLine({ quantity: Number(e.target.value) })} aria-label="Quantité" />
                      </LineField>
                      <LineField label="Unité" className="col-span-4 sm:col-span-2">
                        <Input value={line.unit} onChange={(e) => setLine({ unit: e.target.value })} aria-label="Unité" />
                      </LineField>
                      <LineField label="TVA %" className="col-span-4 sm:col-span-2">
                        <Input type="number" step="0.5" min="0" value={line.vat_rate} onChange={(e) => setLine({ vat_rate: Number(e.target.value) })} aria-label="TVA %" />
                      </LineField>
                      <LineField label="Prix unitaire HT" className="col-span-7 sm:col-span-3">
                        <MoneyInput value={line.unit_price} onChange={(unit_price) => setLine({ unit_price })} />
                      </LineField>
                      <LineField label="Montant HT" className="col-span-5 sm:col-span-3">
                        <p className="flex h-10 items-center justify-end text-sm font-medium tabular-nums">{cfa(t.amount)}</p>
                      </LineField>
                    </div>
                  );
                })}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    <CatalogPicker tradeId={lot.trade_id} onPick={(item) => updateLot(lot.key, { lines: [...lot.lines, {
                      key: nextKey++, catalog_item_id: item.id, designation: item.designation, unit: item.unit, quantity: 1, unit_price: item.unit_price, vat_rate: item.vat_rate ?? defaultVat,
                    }] })} />
                    <Button type="button" variant="ghost" size="sm" onClick={() => updateLot(lot.key, { lines: [...lot.lines, { key: nextKey++, catalog_item_id: null, designation: "", unit: "", quantity: 1, unit_price: "", vat_rate: defaultVat }] })}>
                      <Plus className="h-4 w-4" /> Ligne libre
                    </Button>
                  </div>
                  <p className="text-sm">Total du lot <span className="font-semibold tabular-nums">{cfa(totals.byLot[lotIndex] ?? 0)}</span> HT</p>
                </div>
              </div>
            </Panel>
          ))}

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-4">
            <span className="text-sm text-muted-foreground">Ajouter un lot :</span>
            <Select onValueChange={(v) => addLot(v === "none" ? null : Number(v))} value="">
              <SelectTrigger className="w-64"><SelectValue placeholder="Choisir le corps de métier" /></SelectTrigger>
              <SelectContent>
                {trades.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                <SelectItem value="none">Autre (sans corps de métier)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Panel title="Totaux">
            {totals.discountAmount > 0 && <AmountRow label="Total HT avant remise" value={totals.subtotal} tone="muted" />}
            {totals.discountAmount > 0 && <AmountRow label={`Remise ${discount} %`} value={-totals.discountAmount} tone="muted" />}
            <AmountRow label="Total HT" value={totals.net} />
            <AmountRow label="TVA" value={totals.vat} tone="muted" />
            <AmountRow label="Total TTC" value={totals.total} strong />
            {(deposit ?? 0) > 0 && <p className="mt-1 text-xs text-muted-foreground">Acompte à la commande : {cfa(Math.round((totals.total * (deposit ?? 0)) / 100))}</p>}
          </Panel>
          <Panel title="Conditions">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Remise (%)" htmlFor="q-discount" error={err("discount_rate")}>
                  <Input id="q-discount" type="number" min={0} max={100} step="0.5" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
                </Field>
                <Field label="Acompte (%)" htmlFor="q-deposit" error={err("deposit_rate")}>
                  <Input id="q-deposit" type="number" min={0} max={100} step="5" value={deposit ?? ""} placeholder="30" onChange={(e) => setDeposit(e.target.value === "" ? null : Number(e.target.value))} />
                </Field>
              </div>
              <Field label="Conditions imprimées" htmlFor="q-conditions">
                <Textarea id="q-conditions" rows={4} value={conditions ?? ""} placeholder="Par défaut : validité 30 jours, acompte à la commande…" onChange={(e) => setConditions(e.target.value)} />
              </Field>
              <Field label="Notes internes" htmlFor="q-notes" hint="Non imprimées.">
                <Textarea id="q-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>
          </Panel>
        </aside>
      </div>
    </form>
  );
}

function LineField({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return <div className={className}><p className="mb-0.5 text-[11px] text-muted-foreground">{label}</p>{children}</div>;
}

function CatalogPicker({ tradeId, onPick }: { tradeId: number | null; onPick: (item: CatalogItem) => void }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const { data = [], isFetching } = useQuery({
    queryKey: ["catalog-items", { tradeId, term }],
    queryFn: () => api<{ data: CatalogItem[] }>("/catalog-items", { query: { trade_id: tradeId ?? undefined, search: term || undefined, limit: 50 } }).then((r) => r.data),
    enabled: open,
  });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm"><BookOpen className="h-4 w-4" /> Depuis le catalogue</Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 max-w-[90vw] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Rechercher une prestation…" value={term} onValueChange={setTerm} />
          <CommandList>
            <CommandEmpty>{isFetching ? "Recherche…" : "Aucune prestation."}</CommandEmpty>
            <CommandGroup>
              {data.map((item) => (
                <CommandItem key={item.id} value={String(item.id)} onSelect={() => { onPick(item); setOpen(false); setTerm(""); }}>
                  <span className="min-w-0 flex-1 truncate">{item.designation}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{cfa(item.unit_price)} / {item.unit}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
