/**
 * Client de l'API Laravel : jeton Bearer, JSON, erreurs de validation (422) remontées par champ.
 */

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";
const TOKEN_KEY = "borom_token";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors: Record<string, string[]> = {},
    public data: unknown = null,
  ) {
    super(message);
  }

  /** Premier message d'erreur d'un champ, pour l'afficher sous le champ. */
  field(name: string): string | undefined {
    return this.errors[name]?.[0];
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Navigation privée : la session ne survivra pas au rechargement.
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

export function withQuery(path: string, query?: Query): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, typeof value === "boolean" ? (value ? "1" : "0") : String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Query;
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query } = options;
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${withQuery(path, query)}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, "Connexion impossible. Vérifiez votre réseau et réessayez.");
  }

  if (response.status === 204) return undefined as T;

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && token) {
      setToken(null);
      window.dispatchEvent(new Event("borom:logout"));
    }
    const message =
      (data && typeof data === "object" && "message" in data && typeof data.message === "string" && data.message) ||
      defaultMessage(response.status);
    const errors = (data && typeof data === "object" && "errors" in data ? data.errors : {}) as Record<string, string[]>;
    throw new ApiError(response.status, message, errors, data);
  }

  return data as T;
}

function defaultMessage(status: number): string {
  if (status === 403) return "Vous n'avez pas les droits pour cette action.";
  if (status === 404) return "Élément introuvable.";
  if (status === 429) return "Trop de requêtes. Patientez un instant.";
  if (status >= 500) return "Erreur du serveur. Réessayez dans un instant.";
  return "Une erreur est survenue.";
}

/** Récupère un fichier protégé (photo privée) et renvoie une adresse locale affichable. */
export async function fetchBlobUrl(path: string): Promise<string> {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new ApiError(response.status, defaultMessage(response.status));
  return URL.createObjectURL(await response.blob());
}

/** Télécharge un fichier protégé (pièces) en gardant le jeton, puis l'ouvre. */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new ApiError(response.status, defaultMessage(response.status));
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
