/**
 * RBAC côté écran : rôles et catalogue des permissions, et garde « pas d'escalade » (le serveur
 * refuse de toute façon ; ceci grise seulement les cases qu'on ne peut pas cocher).
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "./auth";
import type { PermissionModule, Role } from "./types";

export function useRolesData() {
  const roles = useQuery({ queryKey: ["roles"], queryFn: () => api<{ data: Role[] }>("/roles").then((r) => r.data) });
  const modules = useQuery({ queryKey: ["permissions"], queryFn: () => api<{ data: PermissionModule[] }>("/permissions").then((r) => r.data) });
  return { roles: roles.data, modules: modules.data, isLoading: roles.isLoading || modules.isLoading };
}

/** Raison pour laquelle le compte connecté ne peut pas donner un droit, ou null. */
export function useGrantLock() {
  const { user, isSuperAdmin } = useAuth();
  const mine = useMemo(() => new Set(user?.permissions ?? []), [user]);
  return (name: string) => (isSuperAdmin || mine.has(name) ? null : "Vous n'avez pas ce droit : vous ne pouvez pas le donner.");
}
