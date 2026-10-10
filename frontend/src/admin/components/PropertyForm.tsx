import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { ApiError } from "@/lib/api";
import { useOptions } from "../hooks";
import type { Property } from "../types";
import { Field } from "./ui";

export type PropertyPayload = Record<string, unknown>;

const numberFields = ["price", "charges", "deposit_months", "advance_months", "surface", "land_surface", "rooms", "bedrooms", "bathrooms"] as const;

/** Formulaire de création et de modification d'un bien. Le statut se change ailleurs (vérification foncière). */
export function PropertyForm({
  property,
  error,
  pending,
  onSubmit,
  onCancel,
}: {
  property?: Property;
  error: ApiError | null;
  pending: boolean;
  onSubmit: (payload: PropertyPayload) => void;
  onCancel?: () => void;
}) {
  const types = useOptions("property_types");
  const transactions = useOptions("transaction_types");
  const landStatuses = useOptions("land_statuses");

  const [form, setForm] = useState<Record<string, string | boolean>>(() => ({
    title: property?.title ?? "",
    type: property?.type.value ?? "appartement",
    transaction: property?.transaction.value ?? "vente",
    city: property?.city ?? "Dakar",
    neighborhood: property?.neighborhood ?? "",
    address: property?.address ?? "",
    land_status: property?.land_status.value ?? "inconnu",
    land_reference: property?.land_reference ?? "",
    description: property?.description ?? "",
    features: property?.features.join(", ") ?? "",
    is_featured: property?.is_featured ?? false,
    ...Object.fromEntries(numberFields.map((f) => [f, property?.[f] != null ? String(property[f]) : ""])),
  }));

  const set = (key: string, value: string | boolean) => setForm({ ...form, [key]: value });
  const isRental = form.transaction === "location";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const payload: PropertyPayload = { ...form };
    for (const f of numberFields) payload[f] = form[f] === "" ? null : Number(String(form[f]).replace(/\s/g, ""));
    payload.features = String(form.features).split(",").map((s) => s.trim()).filter(Boolean);
    for (const f of ["neighborhood", "address", "land_reference", "description"]) if (payload[f] === "") payload[f] = null;
    onSubmit(payload);
  };

  const text = (key: string, label: string, props: Record<string, unknown> = {}) => (
    <Field label={label} htmlFor={key} error={error?.field(key)}>
      <Input id={key} value={String(form[key])} onChange={(e) => set(key, e.target.value)} {...props} />
    </Field>
  );

  const select = (key: string, label: string, options: { value: string; label: string }[]) => (
    <Field label={label} htmlFor={key} error={error?.field(key)}>
      <Select value={String(form[key])} onValueChange={(v) => set(key, v)}>
        <SelectTrigger id={key}><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
      </Select>
    </Field>
  );

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="space-y-4">
        {text("title", "Titre de l'annonce", { required: true, placeholder: "Appartement F4 avec terrasse - Mermoz" })}
        <div className="grid gap-4 sm:grid-cols-3">
          {select("type", "Type", types)}
          {select("transaction", "Transaction", transactions)}
          {text("price", isRental ? "Loyer mensuel (FCFA)" : "Prix (FCFA)", { required: true, inputMode: "numeric" })}
        </div>
        {isRental && (
          <div className="grid gap-4 sm:grid-cols-3">
            {text("charges", "Charges mensuelles (FCFA)", { inputMode: "numeric" })}
            {text("deposit_months", "Caution (mois)", { inputMode: "numeric" })}
            {text("advance_months", "Avance (mois)", { inputMode: "numeric" })}
          </div>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-5">
        {text("surface", "Surface (m²)", { inputMode: "numeric" })}
        {text("land_surface", "Terrain (m²)", { inputMode: "numeric" })}
        {text("rooms", "Pièces", { inputMode: "numeric" })}
        {text("bedrooms", "Chambres", { inputMode: "numeric" })}
        {text("bathrooms", "Salles de bain", { inputMode: "numeric" })}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {text("city", "Ville", { required: true })}
        {text("neighborhood", "Quartier")}
        {text("address", "Adresse (non publiée)")}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {select("land_status", "Situation juridique", landStatuses)}
        {text("land_reference", "N° de titre foncier ou de bail")}
      </section>

      <Field label="Équipements (séparés par des virgules)" htmlFor="features" error={error?.field("features")}>
        <Input id="features" placeholder="Piscine, Climatisation, Gardien 24h" value={String(form.features)} onChange={(e) => set("features", e.target.value)} />
      </Field>
      <Field label="Description" htmlFor="description" error={error?.field("description")}>
        <Textarea id="description" rows={5} value={String(form.description)} onChange={(e) => set("description", e.target.value)} />
      </Field>
      <label className="flex items-center gap-3 text-sm">
        <Switch checked={Boolean(form.is_featured)} onCheckedChange={(v) => set("is_featured", v)} /> Mettre en avant sur l'accueil du site
      </label>

      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>}
        <Button type="submit" disabled={pending}>Enregistrer</Button>
      </div>
    </form>
  );
}
