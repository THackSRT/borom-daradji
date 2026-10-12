import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, ApiError, downloadFile, withQuery } from "@/lib/api";
import { useApiMutation } from "../hooks";
import { PeriodPicker } from "../components/PeriodPicker";
import { periodQuery, type Period } from "../period";
import { Field, FormError, LoadingBlock, PageHeader, Panel } from "../components/ui";

interface Accounts {
  journals: { sales: string; purchases: string; treasury: string };
  clients: string;
  client_prefix: string;
  suppliers: string;
  supplier_prefix: string;
  sales: Record<string, string>;
  vat_collected: string;
  vat_deductible: string;
  purchases: string;
  treasury: Record<string, string>;
}
interface Settings { accounts: Accounts; defaults: Accounts; types: Record<string, string> }

const DESCRIPTIONS: Record<string, string> = {
  ventes: "Factures et avoirs émis : client au débit, ventes par activité et TVA collectée au crédit.",
  encaissements: "Paiements reçus : trésorerie du mode (caisse, Wave, banque…) au débit, client au crédit.",
  achats: "Achats aux fournisseurs (achats, TVA déductible, fournisseur) et leurs règlements.",
  "balance-clients": "Par client à la date de fin : facturé, avoirs, encaissé, solde, part échue.",
  "balance-fournisseurs": "Par fournisseur à la date de fin : achats, payé, solde, part échue.",
};
const ACTIVITIES: Record<string, string> = { immobilier: "Immobilier (commissions)", location: "Location et gestion", travaux: "Travaux", negoce: "Matériaux", autre: "Autre" };
const METHODS: Record<string, string> = { especes: "Espèces (caisse)", wave: "Wave", orange_money: "Orange Money", free_money: "Free Money", cheque: "Chèques", virement: "Virements (banque)", caution: "Retenue sur caution" };

/** Exports Excel pour le cabinet comptable, et numéros de compte SYSCOHADA utilisés. */
export default function ExportsPage() {
  const today = new Date().toLocaleDateString("en-CA");
  const [period, setPeriod] = useState<Period>({ preset: "mois_precedent", from: today.slice(0, 8) + "01", to: today });
  const [busy, setBusy] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["accounting-settings"], queryFn: () => api<{ data: Settings }>("/settings/accounting").then((r) => r.data) });

  async function download(type: string) {
    setBusy(type);
    try {
      await downloadFile(withQuery(`/reports/exports/${type}`, periodQuery(period)), `${type}.xlsx`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Export impossible.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader title="Exports comptables" description="Fichiers Excel pour le cabinet comptable : écritures prêtes à importer (journal, date, pièce, compte, débit, crédit) et détail lisible." />
      <div className="mb-6"><PeriodPicker value={period} onChange={setPeriod} /></div>
      {isLoading || !data ? <LoadingBlock /> : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            {Object.entries(data.types).map(([type, label]) => (
              <div key={type} className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
                <FileSpreadsheet className="h-8 w-8 shrink-0 text-emerald-700" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{DESCRIPTIONS[type]}</p>
                </div>
                <Button variant="outline" disabled={busy !== null} onClick={() => download(type)}><Download className="h-4 w-4" /> {busy === type ? "…" : "Excel"}</Button>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Le format des colonnes est générique : à faire valider par le cabinet (Sage, Ciel…) avant le premier import.</p>
          </div>
          <AccountsForm settings={data} />
        </div>
      )}
    </>
  );
}

function AccountsForm({ settings }: { settings: Settings }) {
  const [form, setForm] = useState<Accounts>(settings.accounts);
  useEffect(() => setForm(settings.accounts), [settings.accounts]);
  const mutation = useApiMutation(() => api("/settings/accounting", { method: "PUT", body: form }), { success: "Numéros de compte enregistrés.", invalidate: [["accounting-settings"]] });
  const err = (f: string) => mutation.error?.field(f);
  const d = settings.defaults;
  const acc = (label: string, value: string, def: string, onChange: (v: string) => void, error?: string) => (
    <Field label={label} error={error} hint={value !== def ? `Par défaut : ${def}` : undefined}>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="font-mono" />
    </Field>
  );

  return (
    <Panel title="Numéros de compte (SYSCOHADA)" action={<Button size="sm" variant="ghost" onClick={() => setForm(d)}><RotateCcw className="h-4 w-4" /> Valeurs proposées</Button>}>
      <div className="space-y-5">
        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Journaux</p>
          <div className="grid grid-cols-3 gap-3">
            {acc("Ventes", form.journals.sales, d.journals.sales, (v) => setForm({ ...form, journals: { ...form.journals, sales: v } }), err("journals.sales"))}
            {acc("Achats", form.journals.purchases, d.journals.purchases, (v) => setForm({ ...form, journals: { ...form.journals, purchases: v } }), err("journals.purchases"))}
            {acc("Trésorerie", form.journals.treasury, d.journals.treasury, (v) => setForm({ ...form, journals: { ...form.journals, treasury: v } }), err("journals.treasury"))}
          </div>
        </section>
        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Tiers</p>
          <div className="grid grid-cols-2 gap-3">
            {acc("Clients", form.clients, d.clients, (v) => setForm({ ...form, clients: v }), err("clients"))}
            {acc("Préfixe compte client", form.client_prefix, d.client_prefix, (v) => setForm({ ...form, client_prefix: v }), err("client_prefix"))}
            {acc("Fournisseurs", form.suppliers, d.suppliers, (v) => setForm({ ...form, suppliers: v }), err("suppliers"))}
            {acc("Préfixe compte fournisseur", form.supplier_prefix, d.supplier_prefix, (v) => setForm({ ...form, supplier_prefix: v }), err("supplier_prefix"))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Compte de tiers = préfixe + numéro de la fiche sur 5 chiffres (ex. {form.client_prefix}00023).</p>
        </section>
        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Ventes par activité, TVA, achats</p>
          <div className="grid grid-cols-2 gap-3">
            {Object.keys(d.sales).map((k) => acc(ACTIVITIES[k] ?? k, form.sales[k] ?? "", d.sales[k], (v) => setForm({ ...form, sales: { ...form.sales, [k]: v } }), err(`sales.${k}`)))}
            {acc("TVA collectée", form.vat_collected, d.vat_collected, (v) => setForm({ ...form, vat_collected: v }), err("vat_collected"))}
            {acc("TVA déductible", form.vat_deductible, d.vat_deductible, (v) => setForm({ ...form, vat_deductible: v }), err("vat_deductible"))}
            {acc("Achats de marchandises", form.purchases, d.purchases, (v) => setForm({ ...form, purchases: v }), err("purchases"))}
          </div>
        </section>
        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Trésorerie par mode de paiement</p>
          <div className="grid grid-cols-2 gap-3">
            {Object.keys(d.treasury).map((k) => acc(METHODS[k] ?? k, form.treasury[k] ?? "", d.treasury[k], (v) => setForm({ ...form, treasury: { ...form.treasury, [k]: v } }), err(`treasury.${k}`)))}
          </div>
        </section>
        <FormError message={mutation.error && !Object.keys(mutation.error.errors).length ? mutation.error.message : undefined} />
        <Button onClick={() => mutation.mutate(undefined)} disabled={mutation.isPending}>Enregistrer les comptes</Button>
        <p className="text-xs text-muted-foreground">Valeurs proposées à faire valider par le cabinet comptable.</p>
      </div>
    </Panel>
  );
}
