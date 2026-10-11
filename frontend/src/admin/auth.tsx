import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { api, getToken, setToken } from "@/lib/api";
import type { RoleValue, User } from "./types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: RoleValue[]) => boolean;
  isDirigeant: boolean;
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
    const hasRole = (...roles: RoleValue[]) =>
      !!current && (current.roles.some((r) => r.value === "dirigeant") || current.roles.some((r) => roles.includes(r.value)));
    return {
      user: current,
      isLoading: hasToken && isLoading,
      login,
      logout,
      hasRole,
      isDirigeant: !!current?.roles.some((r) => r.value === "dirigeant"),
    };
  }, [hasToken, user, isLoading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return context;
}

/** Protège une page : connexion obligatoire, et éventuellement un des rôles donnés (le dirigeant passe toujours). */
export function RequireAuth({ children, roles }: { children: ReactNode; roles?: RoleValue[] }) {
  const { user, isLoading, hasRole } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/admin/connexion" replace state={{ from: location.pathname }} />;

  if (roles && !hasRole(...roles)) {
    return <p className="p-8 text-muted-foreground">Vous n'avez pas accès à cette page.</p>;
  }

  return <>{children}</>;
}
