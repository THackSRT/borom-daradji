import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { cacheGet, cacheSet } from "./db";

/**
 * Lecture « réseau d'abord, sinon téléphone » : chaque réponse est gardée ; sans réseau, on rend la
 * dernière connue (avec sa date, pour l'afficher).
 */
export function useCachedQuery<T>(key: string, fetcher: () => Promise<T>, enabled = true) {
  return useQuery({
    queryKey: ["terrain", key],
    enabled,
    retry: false,
    queryFn: async (): Promise<{ value: T; savedAt: number | null }> => {
      try {
        const value = await fetcher();
        void cacheSet(key, value);
        return { value, savedAt: null };
      } catch (e) {
        if (e instanceof ApiError && e.status !== 0) throw e;
        const cached = await cacheGet<T>(key);
        if (cached) return cached;
        throw e;
      }
    },
  });
}
