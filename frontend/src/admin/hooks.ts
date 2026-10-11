import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import type { Meta, MetaKey, Option } from "./types";

/** Listes fermées (types, statuts…) avec leurs libellés français, chargées une fois. */
export function useMeta() {
  return useQuery({
    queryKey: ["meta"],
    queryFn: () => api<{ data: Meta }>("/meta").then((r) => r.data),
    staleTime: Infinity,
  });
}

export function useOptions(key: MetaKey): Option[] {
  const { data } = useMeta();
  return data?.[key] ?? [];
}

/**
 * Mutation avec message de succès et rafraîchissement des listes concernées.
 * Les erreurs de validation (422) restent dans `error` pour être affichées sous les champs ;
 * les autres erreurs s'affichent en notification.
 */
export function useApiMutation<TVars, TResult = unknown>(
  fn: (vars: TVars) => Promise<TResult>,
  options: { success?: string; invalidate?: QueryKey[]; onSuccess?: (result: TResult) => void } = {},
) {
  const queryClient = useQueryClient();

  return useMutation<TResult, ApiError, TVars>({
    mutationFn: fn,
    onSuccess: (result) => {
      if (options.success) toast.success(options.success);
      options.invalidate?.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
      options.onSuccess?.(result);
    },
    onError: (error) => {
      if (error.status !== 422 && error.status !== 409) toast.error(error.message);
    },
  });
}

export { api };
