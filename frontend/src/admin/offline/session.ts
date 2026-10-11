import { getToken } from "@/lib/api";
import type { User } from "../types";

const ME_KEY = "borom_me";

/** Dernier profil connu : sur le terrain, sans réseau, l'application reste utilisable. */
export function cachedUser(): User | undefined {
  try {
    const raw = localStorage.getItem(ME_KEY);
    return raw ? (JSON.parse(raw) as User) : undefined;
  } catch {
    return undefined;
  }
}

export function storeUser(user: User | null): void {
  try {
    if (user) localStorage.setItem(ME_KEY, JSON.stringify(user));
    else localStorage.removeItem(ME_KEY);
  } catch {
    // Navigation privée.
  }
}

export function cachedUserId(): number | null {
  return getToken() ? (cachedUser()?.id ?? null) : null;
}
