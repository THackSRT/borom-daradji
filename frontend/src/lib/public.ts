/**
 * Site vitrine : appels à l'API publique (catalogue, lieux, coordonnées, demandes des visiteurs).
 */
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { api, ApiError } from "./api";
import { fetchSite, siteQueryKey } from "./site";

export interface Option {
  value: string;
  label: string;
}

export interface PublicProperty {
  reference: string;
  slug: string;
  title: string;
  type: Option;
  transaction: Option;
  status: Option;
  price: number;
  charges: number | null;
  deposit_months: number | null;
  advance_months: number | null;
  surface: number | null;
  land_surface: number | null;
  rooms: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  features: string[];
  city: string;
  neighborhood: string | null;
  description: string | null;
  land_status: Option;
  is_featured: boolean;
  cover_url: string | null;
  photos?: string[];
  whatsapp_url: string | null;
  published_at: string | null;
}

export interface Company {
  trade_name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
}

interface Page<T> {
  data: T[];
  meta: { current_page: number; last_page: number; total: number };
}

const cfa = new Intl.NumberFormat("fr-FR");

/** Listes fermées du site (mêmes valeurs que l'API). */
export const propertyTypes: Option[] = [
  { value: "appartement", label: "Appartement" },
  { value: "maison", label: "Maison" },
  { value: "villa", label: "Villa" },
  { value: "terrain", label: "Terrain" },
  { value: "local", label: "Local commercial" },
  { value: "immeuble", label: "Immeuble" },
];

export const transactionTypes: Option[] = [
  { value: "vente", label: "Acheter" },
  { value: "location", label: "Louer" },
];

/** Budgets proposés dans les filtres : prix de vente ou loyers mensuels. */
export function budgetOptions(transaction: string | undefined): Option[] {
  const values = transaction === "location"
    ? [150_000, 300_000, 500_000, 1_000_000, 2_000_000]
    : [25_000_000, 50_000_000, 100_000_000, 200_000_000, 500_000_000];
  return values.map((v) => ({ value: String(v), label: `${cfa.format(v)} FCFA${transaction === "location" ? "/mois" : ""}` }));
}

export type CatalogQuery = Partial<Record<"type" | "transaction" | "city" | "neighborhood" | "priceMin" | "priceMax" | "surfaceMin" | "search" | "sort", string>> & {
  page?: number;
  per_page?: number;
  featured?: boolean;
};

export function useCatalog(query: CatalogQuery) {
  return useQuery({
    queryKey: ["public-properties", query],
    queryFn: () => api<Page<PublicProperty>>("/public/properties", { query }),
    placeholderData: keepPreviousData,
  });
}

export function usePublicProperty(slug: string | undefined) {
  return useQuery({
    queryKey: ["public-property", slug],
    queryFn: () => api<{ data: PublicProperty }>(`/public/properties/${slug}`).then((r) => r.data),
    enabled: !!slug,
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 1,
  });
}

/** Villes et quartiers réellement présents dans le catalogue. */
export function usePlaces() {
  return useQuery({
    queryKey: ["public-places"],
    queryFn: () => api<{ data: { city: string; neighborhoods: string[] }[] }>("/public/places").then((r) => r.data),
    staleTime: 10 * 60_000,
  });
}

/** Coordonnées de l'agence, saisies par le dirigeant dans les paramètres (même appel que le contenu du site). */
export function useCompany() {
  return useQuery({ queryKey: siteQueryKey, queryFn: fetchSite, staleTime: 30 * 60_000, select: (site) => site.company });
}

export interface LeadPayload {
  name: string;
  phone: string;
  email?: string;
  message: string;
  property?: string;
  /** Champ piège : laissé vide par les humains. */
  website?: string;
}

/** Envoie une demande de visiteur : elle arrive chez l'agent sous forme de prospect et de tâche. */
export function useSendLead() {
  return useMutation<{ message: string }, ApiError, LeadPayload>({
    mutationFn: (body) => api("/public/leads", { method: "POST", body }),
  });
}

export function formatPrice(property: Pick<PublicProperty, "price" | "transaction">): string {
  return `${cfa.format(property.price)} FCFA${property.transaction.value === "location" ? "/mois" : ""}`;
}

/** « +221771234567 » → « +221 77 123 45 67 » pour l'affichage. */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const m = phone.match(/^\+221(\d{2})(\d{3})(\d{2})(\d{2})$/);
  return m ? `+221 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone;
}

export function whatsappLink(phone: string | null | undefined, text = ""): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
