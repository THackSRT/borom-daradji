import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { cachedUserId } from "./session";
import { idb } from "./db";

/**
 * File d'attente des saisies de terrain. Chaque saisie porte un identifiant unique (client_uuid) : si
 * l'envoi est coupé après que le serveur l'a reçue, le renvoi ne crée pas de doublon (le serveur
 * reconnaît l'identifiant). Envoi dans l'ordre de saisie, au retour du réseau, toutes les minutes
 * tant qu'il reste quelque chose, ou à la demande.
 */

export type OutboxKind = "photo" | "attendance" | "expense";

export interface OutboxItem {
  id: string;
  kind: OutboxKind;
  worksiteId: number;
  worksiteLabel: string;
  /** Résumé affiché : « 3 présents », « Ciment — 45 000 FCFA »… */
  summary: string;
  fields: Record<string, string | number | boolean | null | Array<Record<string, unknown>>>;
  file?: Blob | null;
  fileName?: string;
  createdAt: number;
  attempts: number;
  /** Auteur : sur un téléphone partagé, seules ses saisies partent avec sa session. */
  userId: number | null;
  /** Refus du serveur (droit, chantier fermé, donnée invalide) : la saisie attend une décision. */
  error?: string | null;
}

const EVENT = "borom:outbox";
const notify = () => window.dispatchEvent(new Event(EVENT));

export async function enqueue(item: Omit<OutboxItem, "createdAt" | "attempts" | "userId">): Promise<void> {
  await idb.put("outbox", { ...item, userId: cachedUserId(), createdAt: Date.now(), attempts: 0, error: null });
  notify();
  void flush();
}

/** Saisies de la personne connectée, dans l'ordre. */
export async function listOutbox(): Promise<OutboxItem[]> {
  const me = cachedUserId();
  try {
    return (await idb.all<OutboxItem>("outbox")).filter((i) => i.userId === me).sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

export async function discard(id: string): Promise<void> {
  await idb.delete("outbox", id);
  notify();
}

function request(item: OutboxItem): Promise<unknown> {
  const base = `/worksites/${item.worksiteId}`;
  if (item.kind === "attendance") {
    return api(`${base}/attendances`, { method: "POST", body: item.fields });
  }
  const form = new FormData();
  for (const [key, value] of Object.entries(item.fields)) {
    if (value === null || value === undefined) continue;
    form.append(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
  }
  if (item.file) form.append(item.kind === "photo" ? "photo" : "receipt", item.file, item.fileName ?? "photo.jpg");
  return api(item.kind === "photo" ? `${base}/photos` : `${base}/cash`, { method: "POST", body: form });
}

let running: Promise<{ sent: number; left: number }> | null = null;

/** Envoie ce qui attend. Renvoie le nombre d'envois réussis et ce qui reste. */
export function flush(): Promise<{ sent: number; left: number }> {
  running ??= (async () => {
    let sent = 0;
    const items = await listOutbox();
    for (const item of items) {
      if (item.error) continue;
      if (!navigator.onLine) break;
      try {
        await request(item);
        await idb.delete("outbox", item.id);
        sent++;
        notify();
      } catch (e) {
        const error = e instanceof ApiError ? e : null;
        // Pas de réseau ou serveur indisponible : on réessaiera plus tard, dans le même ordre.
        if (!error || error.status === 0 || error.status === 429 || error.status >= 500) {
          await idb.put("outbox", { ...item, attempts: item.attempts + 1 });
          break;
        }
        // Session expirée : on garde tout, l'envoi reprendra après reconnexion.
        if (error.status === 401) break;
        const detail = Object.values(error.errors).flat()[0] ?? error.message;
        await idb.put("outbox", { ...item, attempts: item.attempts + 1, error: detail });
        notify();
      }
    }
    const left = (await listOutbox()).length;
    return { sent, left };
  })().finally(() => {
    running = null;
    notify();
  });
  return running;
}

/** À monter une fois (mise en page du back-office) : relance l'envoi au retour du réseau et chaque minute. */
export function useOutboxAutoSync(): void {
  useEffect(() => {
    const kick = () => { void flush(); };
    window.addEventListener("online", kick);
    const timer = window.setInterval(() => {
      void listOutbox().then((items) => { if (items.some((i) => !i.error)) kick(); });
    }, 60_000);
    kick();
    return () => { window.removeEventListener("online", kick); window.clearInterval(timer); };
  }, []);
}

/** État de la file pour l'écran : saisies en attente, envoi en cours, réseau. */
export function useOutbox() {
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);

  const refresh = useCallback(() => { void listOutbox().then(setItems); }, []);
  useEffect(() => {
    refresh();
    const onNet = () => setOnline(navigator.onLine);
    window.addEventListener(EVENT, refresh);
    window.addEventListener("online", onNet);
    window.addEventListener("offline", onNet);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener("online", onNet);
      window.removeEventListener("offline", onNet);
    };
  }, [refresh]);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      return await flush();
    } finally {
      setSyncing(false);
      refresh();
    }
  }, [refresh]);

  return { items, pending: items.filter((i) => !i.error).length, failed: items.filter((i) => i.error).length, syncing, online, sync, refresh };
}
