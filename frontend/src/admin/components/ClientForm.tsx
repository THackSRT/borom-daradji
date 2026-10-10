import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ApiError } from "@/lib/api";
import { useOptions } from "../hooks";
import type { Client } from "../types";
import { Field } from "./ui";

export function ClientForm({
  client,
  error,
  pending,
  onSubmit,
  onCancel,
}: {
  client?: Client;
  error: ApiError | null;
  pending: boolean;
  onSubmit: (payload: Record<string, unknown>) => void;
  onCancel?: () => void;
}) {
  const kinds = useOptions("client_kinds");
  const categories = useOptions("client_categories");
  const sources = useOptions("lead_sources");
  const [form, setForm] = useState({
    kind: client?.kind.value ?? "particulier",
    name: client?.name ?? "",
    phone: client?.phone ?? "",
    whatsapp: client?.whatsapp ?? "",
    email: client?.email ?? "",
    city: client?.city ?? "",
    address: client?.address ?? "",
    source: client?.source?.value ?? "",
    categories: client?.categories.map((c) => c.value) ?? [],
    tags: client?.tags.join(", ") ?? "",
    private_notes: client?.private_notes ?? "",
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = { ...form, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean) };
    for (const key of ["phone", "whatsapp", "email", "city", "address", "source", "private_notes"]) {
      if (payload[key] === "") payload[key] = null;
    }
    if (client && client.private_notes === undefined) delete payload.private_notes;
    onSubmit(payload);
  };

  const input = (key: keyof typeof form, label: string, props: Record<string, unknown> = {}) => (
    <Field label={label} htmlFor={key} error={error?.field(key)}>
      <Input id={key} value={String(form[key])} onChange={(e) => setForm({ ...form, [key]: e.target.value })} {...props} />
    </Field>
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Type" htmlFor="kind">
          <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
            <SelectTrigger id="kind"><SelectValue /></SelectTrigger>
            <SelectContent>{kinds.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <div className="sm:col-span-2">{input("name", form.kind === "entreprise" ? "Raison sociale" : "Nom complet", { required: true })}</div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {input("phone", "Téléphone", { placeholder: "77 123 45 67" })}
        {input("whatsapp", "WhatsApp (si différent)")}
        {input("email", "Email", { type: "email" })}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {input("city", "Ville")}
        {input("address", "Adresse")}
        <Field label="Comment nous a-t-il connus ?" htmlFor="source">
          <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
            <SelectTrigger id="source"><SelectValue placeholder="Choisir" /></SelectTrigger>
            <SelectContent>{sources.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="Catégories">
        <div className="flex flex-wrap gap-4">
          {categories.map((c) => (
            <label key={c.value} className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.categories.includes(c.value)} onCheckedChange={(v) =>
                setForm({ ...form, categories: v === true ? [...form.categories, c.value] : form.categories.filter((x) => x !== c.value) })} />
              {c.label}
            </label>
          ))}
        </div>
      </Field>
      {input("tags", "Étiquettes (séparées par des virgules)", { placeholder: "VIP, Diaspora" })}
      {(!client || client.private_notes !== undefined) && (
        <Field label="Notes privées" htmlFor="private_notes" hint="Visibles seulement par vous (agent assigné) et le dirigeant.">
          <Textarea id="private_notes" rows={3} value={form.private_notes} onChange={(e) => setForm({ ...form, private_notes: e.target.value })} />
        </Field>
      )}
      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>}
        <Button type="submit" disabled={pending}>Enregistrer</Button>
      </div>
    </form>
  );
}
