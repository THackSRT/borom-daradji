import { format, formatDistanceToNow, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

const cfa = new Intl.NumberFormat("fr-FR");

/** 850000000 → « 850 000 000 FCFA » ; loyers suffixés « /mois ». */
export function formatPrice(amount: number | null | undefined, perMonth = false): string {
  if (amount === null || amount === undefined) return "—";
  return `${cfa.format(amount)} FCFA${perMonth ? "/mois" : ""}`;
}

export function formatDate(iso: string | null | undefined, pattern = "d MMM yyyy"): string {
  if (!iso) return "—";
  return format(parseISO(iso), pattern, { locale: fr });
}

export function formatDateTime(iso: string | null | undefined): string {
  return formatDate(iso, "d MMM yyyy 'à' HH'h'mm");
}

export function fromNow(iso: string | null | undefined): string {
  if (!iso) return "jamais";
  return formatDistanceToNow(parseISO(iso), { locale: fr, addSuffix: true });
}

/** Valeur pour un <input type="datetime-local"> à partir d'une date ISO. */
export function toDateTimeInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return format(parseISO(iso), "yyyy-MM-dd'T'HH:mm");
}
