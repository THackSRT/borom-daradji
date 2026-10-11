export type PeriodPreset = "mois" | "mois_precedent" | "trimestre" | "annee" | "annee_precedente" | "personnalisee";

export interface Period { preset: PeriodPreset; from: string; to: string }

/** Paramètres d'API d'une période (préréglage ou dates). */
export function periodQuery(p: Period): Record<string, string> {
  return p.preset === "personnalisee" ? { from: p.from, to: p.to } : { period: p.preset };
}
