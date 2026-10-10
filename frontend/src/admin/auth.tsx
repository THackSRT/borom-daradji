import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { api, getToken, setToken } from "@/lib/api";
import type { User } from "./types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Vrai si le compte a au moins une de ces permissions (le dirigeant les a toutes). */
  can: (...permissions: string[]) => boolean;
  isSuperAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [hasToken, setHasToken] = useState(() => getToken() !== null);

  const { data: user, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<{ data: User }>("/auth/me").then((r) => r.data),
    enabled: hasToken,
    retry: false,
    staleTime: 5 * 60_000,
  });

  // Jeton expiré ou compte désactivé : l'API renvoie 401, le client nous prévient.
  useEffect(() => {
    const onLogout = () => {
      setHasToken(false);
      queryClient.clear();
    };
    window.addEventListener("borom:logout", onLogout);
    return () => window.removeEventListener("borom:logout", onLogout);
  }, [queryClient]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const result = await api<{ token: string; user: User }>("/auth/login", {
        method: "POST",
        body: { login: identifier, password, device_name: navigator.userAgent.slice(0, 100) || "navigateur" },
      });
      setToken(result.token);
      queryClient.setQueryData(["me"], result.user);
      setHasToken(true);
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      setToken(null);
      setHasToken(false);
      queryClient.clear();
    }
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(() => {
    const current = hasToken ? (user ?? null) : null;
    const granted = new Set(current?.permissions ?? []);
    const can = (...permissions: string[]) =>
      !!current && (current.is_super_admin || permissions.some((p) => granted.has(p)));
    return {
      user: current,
      isLoading: hasToken && isLoading,
      login,
      logout,
      can,
      isSuperAdmin: !!current?.is_super_admin,
    };
  }, [hasToken, user, isLoading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return context;
}

/**
 * Protège une page : connexion obligatoire, et éventuellement une des permissions données.
 * L'API vérifie de toute façon chaque appel : ceci n'évite que d'afficher une page inutilisable.
 */
export function RequireAuth({ children, permissions }: { children: ReactNode; permissions?: string[] }) {
  const { user, isLoading, can } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/admin/connexion" replace state={{ from: location.pathname }} />;

  if (permissions && !can(...permissions)) {
    return <p className="p-8 text-muted-foreground">Vous n'avez pas accès à cette page.</p>;
  }

  return <>{children}</>;
}
