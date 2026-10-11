import { api } from "@/lib/api";
import type { PickerItem } from "./components/billing";
import type { Article, Paginated, Worksite } from "./types";

/** Quantité lisible : « 12 », « 2,5 ». */
export function qty(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value);
}

export const searchArticles = (term: string, extra: Record<string, string | number> = {}) =>
  api<Paginated<Article>>("/articles", { query: { search: term, per_page: 15, ...extra } }).then((r) => r.data);

export const searchSuppliers = (term: string): Promise<PickerItem[]> =>
  api<Paginated<{ id: number; name: string; phone: string | null }>>("/clients", { query: { search: term, category: "fournisseur", per_page: 10 } })
    .then((r) => r.data.map((c) => ({ id: c.id, label: c.name, hint: c.phone ?? undefined })));

export const searchClients = (term: string): Promise<PickerItem[]> =>
  api<Paginated<{ id: number; name: string; phone: string | null }>>("/clients", { query: { search: term, per_page: 10 } })
    .then((r) => r.data.map((c) => ({ id: c.id, label: c.name, hint: c.phone ?? undefined })));

export const searchOpenWorksites = (term: string): Promise<PickerItem[]> =>
  api<Paginated<Worksite>>("/worksites", { query: { search: term, state: "ouverts", per_page: 15 } })
    .then((r) => r.data.map((w) => ({ id: w.id, label: `${w.reference} · ${w.title}`, hint: w.client.name })));

export const units = ["sac", "barre", "u", "m³", "m²", "ml", "kg", "t", "voyage", "rouleau", "pot", "litre", "paquet", "carton"];
