/**
 * Identifiant unique d'une saisie (dépense, pointage, photo), envoyé au serveur pour qu'une
 * double soumission ou une synchronisation relancée ne crée pas de doublon. `crypto.randomUUID`
 * n'existe qu'en contexte sécurisé (HTTPS) : repli sur `getRandomValues` sinon.
 */
export function uuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
