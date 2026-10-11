/**
 * Contenu du site vitrine, modifiable par le dirigeant (back-office > Site internet).
 * Les valeurs par défaut sont côté serveur (backend/config/site.php).
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Company } from "./public";

export interface ServiceItem {
  icon: string;
  title: string;
  description: string | null;
  features: string[] | null;
}

export interface StatItem {
  icon: string;
  value: string;
  label: string;
}

export interface ProjectItem {
  title: string;
  location: string | null;
  duration: string | null;
  description: string | null;
  services: string[] | null;
  before_image: string | null;
  after_image: string;
}

export interface SiteContent {
  identity: { tagline: string; show_name: boolean; primary_color: string; accent_color: string };
  seo: { title: string; description: string };
  contact: {
    title: string;
    intro: string;
    form_title: string;
    form_text: string;
    hours: { days: string; hours: string }[];
    subjects: string[];
  };
  social: Record<"facebook" | "instagram" | "linkedin" | "tiktok" | "youtube" | "x", string>;
  footer: { about: string; copyright: string };
  legal: { show_identifiers: boolean; notice: string; privacy: string };
  home: {
    hero_badge: string;
    hero_title: string;
    hero_highlight: string;
    hero_subtitle: string;
    hero_image: string | null;
    show_featured: boolean;
    featured_kicker: string;
    featured_title: string;
    show_services: boolean;
    services_kicker: string;
    services_title: string;
    services_subtitle: string;
    services: ServiceItem[];
    show_why: boolean;
    why_kicker: string;
    why_title: string;
    why_text: string;
    why_points: string[];
    stats: StatItem[];
    show_cta: boolean;
    cta_property_title: string;
    cta_property_text: string;
    cta_property_button: string;
    cta_works_title: string;
    cta_works_text: string;
    cta_works_button: string;
  };
  works: {
    kicker: string;
    hero_title: string;
    hero_subtitle: string;
    services_title: string;
    services_subtitle: string;
    services: ServiceItem[];
    show_projects: boolean;
    projects_title: string;
    projects: ProjectItem[];
    quote_title: string;
    quote_text: string;
    commitments: string[];
  };
}

export type SiteSection = keyof SiteContent;

export interface PublicSite {
  company: Company & { legal_name?: string | null; ninea?: string | null; rccm?: string | null };
  content: SiteContent;
}

export const siteQueryKey = ["public-site"];

export function fetchSite() {
  return api<{ data: PublicSite }>("/public/site").then((r) => r.data);
}

export function useSite() {
  return useQuery({ queryKey: siteQueryKey, queryFn: fetchSite, staleTime: 30 * 60_000 });
}

/** Texte libre saisi dans le back-office : un paragraphe par ligne. */
export function paragraphs(text: string | null | undefined): string[] {
  return (text ?? "").split("\n").map((line) => line.trim()).filter(Boolean);
}

/* ---------- Couleurs de la charte ---------- */

type Hsl = [number, number, number];

export function hexToHsl(hex: string): Hsl | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const n = parseInt(match[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

/** Clarté perçue (0 à 1) : au-dessus de 0,6, le texte posé sur la couleur passe en foncé. */
export function luminance(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, Math.round(v)));
const css = ([h, s, l]: Hsl) => `${(h + 360) % 360} ${clamp(s)}% ${clamp(l)}%`;

/**
 * Variables CSS de la charte (index.css) recalculées à partir des deux couleurs choisies.
 * Les nuances suivent les écarts de la charte d'origine (bleu nuit et or).
 */
export function themeVariables(primary: string, accent: string): Record<string, string> {
  const vars: Record<string, string> = {};
  const p = hexToHsl(primary);
  const a = hexToHsl(accent);
  if (p) {
    const [h, s, l] = p;
    const navy = css([h, s * 0.59, l * 0.44]);
    vars["--primary"] = css(p);
    vars["--ring"] = css(p);
    vars["--navy"] = navy;
    vars["--navy-light"] = css(p);
    vars["--navy-dark"] = css([h, s * 0.59, l * 0.32]);
    vars["--primary-foreground"] = luminance(primary) > 0.6 ? "222 47% 11%" : "40 20% 98%";
    vars["--gradient-hero"] = `linear-gradient(135deg, hsl(${navy}) 0%, hsl(${css(p)}) 100%)`;
    vars["--gradient-overlay"] = `linear-gradient(180deg, transparent 0%, hsla(${navy.replace(/ /g, ", ")}, 0.8) 100%)`;
  }
  if (a) {
    const [h, s, l] = a;
    vars["--accent"] = css(a);
    vars["--gold"] = css(a);
    vars["--gold-light"] = css([h + 6, s + 3, l + 7]);
    vars["--gold-dark"] = css([h - 6, s - 5, l - 5]);
    vars["--accent-foreground"] = luminance(accent) > 0.6 ? "222 47% 11%" : "0 0% 100%";
    vars["--gradient-gold"] = `linear-gradient(135deg, hsl(${css(a)}) 0%, hsl(${css([h + 6, s + 3, l + 7])}) 100%)`;
    vars["--shadow-gold"] = `0 4px 14px 0 hsla(${css(a).replace(/ /g, ", ")}, 0.25)`;
  }
  return vars;
}

/** Initiales affichées quand aucun logo n'est envoyé (« Borom Daradji » → « BD »). */
export function initials(name: string | null | undefined): string {
  const words = (name ?? "").split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase();
}
