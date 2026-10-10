import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { useApiMutation } from "../hooks";
import type { CompanySettings } from "../types";
import { Field, LoadingBlock, PageHeader } from "../components/ui";

type FormState = Record<keyof Omit<CompanySettings, "logo_url" | "currency" | "vat_rate">, string> & { vat_rate: string };

const fields: { key: keyof FormState; label: string; hint?: string; type?: string }[] = [
  { key: "trade_name", label: "Nom commercial" },
  { key: "legal_name", label: "Raison sociale" },
  { key: "ninea", label: "NINEA" },
  { key: "rccm", label: "RCCM" },
  { key: "address", label: "Adresse" },
  { key: "city", label: "Ville" },
  { key: "phone", label: "Téléphone" },
  { key: "whatsapp", label: "WhatsApp", hint: "Utilisé pour le bouton WhatsApp du site." },
  { key: "email", label: "Email", type: "email" },
  { key: "website", label: "Site internet", type: "url" },
  { key: "bank_name", label: "Banque" },
  { key: "bank_account", label: "RIB / IBAN" },
  { key: "vat_rate", label: "Taux de TVA (%)", type: "number" },
];

export default function SettingsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<{ data: CompanySettings }>("/settings/company").then((r) => r.data),
  });
  const [form, setForm] = useState<FormState | null>(null);

  useEffect(() => {
    if (!data) return;
    const next = {} as FormState;
    for (const { key } of fields) next[key] = data[key] === null || data[key] === undefined ? "" : String(data[key]);
    next.invoice_footer = data.invoice_footer ?? "";
    setForm(next);
  }, [data]);

  const save = useApiMutation(
    (body: FormState) => {
      const payload: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(body)) payload[key] = value === "" ? null : value;
      payload.vat_rate = Number(body.vat_rate);
      return api("/settings/company", { method: "PUT", body: payload });
    },
    { success: "Paramètres enregistrés.", invalidate: [["settings"]] },
  );

  const logo = useApiMutation(
    (file: File) => {
      const body = new FormData();
      body.append("logo", file);
      return api("/settings/company/logo", { method: "POST", body });
    },
    { success: "Logo mis à jour.", invalidate: [["settings"]] },
  );

  if (isLoading || !form || !data) return <LoadingBlock />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(form);
  };

  return (
    <>
      <PageHeader title="Paramètres de l'entreprise" description="Repris sur les factures, quittances, devis et le site vitrine." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-lg">Coordonnées et mentions légales</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {fields.map(({ key, label, hint, type }) => (
                  <Field key={key} label={label} htmlFor={key} hint={hint} error={save.error?.field(key)}>
                    <Input id={key} type={type ?? "text"} step={type === "number" ? "0.01" : undefined} value={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                  </Field>
                ))}
              </div>
              <Field label="Pied de facture" htmlFor="invoice_footer" error={save.error?.field("invoice_footer")}>
                <Textarea id="invoice_footer" rows={3} value={form.invoice_footer}
                  onChange={(e) => setForm({ ...form, invoice_footer: e.target.value })} />
              </Field>
              <Button type="submit" variant="gold" disabled={save.isPending}>Enregistrer</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Logo</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex h-32 items-center justify-center rounded-lg border bg-muted/40">
              {data.logo_url ? <img src={data.logo_url} alt="Logo" className="max-h-28 object-contain" /> : <span className="text-sm text-muted-foreground">Aucun logo</span>}
            </div>
            <Button asChild variant="outline" className="w-full" disabled={logo.isPending}>
              <label className="cursor-pointer">
                <Upload className="h-4 w-4" /> Choisir une image
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                  onChange={(e) => e.target.files?.[0] && logo.mutate(e.target.files[0])} />
              </label>
            </Button>
            {logo.error?.field("logo") && <p className="text-xs text-destructive">{logo.error.field("logo")}</p>}
            <p className="text-xs text-muted-foreground">PNG, JPG ou WebP, 2 Mo maximum. Devise : {data.currency}.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
