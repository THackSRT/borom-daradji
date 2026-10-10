import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  Building2,
  CalendarDays,
  ClipboardList,
  History,
  KeyRound,
  LogOut,
  Menu,
  Settings,
  UserCog,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "../auth";
import type { RoleValue } from "../types";
import { PasswordDialog } from "./PasswordDialog";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Building2;
  roles?: RoleValue[];
  dirigeantOnly?: boolean;
}

const navigation: NavItem[] = [
  { to: "/admin", label: "Mes tâches", icon: ClipboardList },
  { to: "/admin/biens", label: "Biens", icon: Building2 },
  { to: "/admin/clients", label: "Clients", icon: Users },
  { to: "/admin/visites", label: "Visites", icon: CalendarDays, roles: ["agent", "commercial"] },
  { to: "/admin/comptes", label: "Comptes", icon: UserCog, dirigeantOnly: true },
  { to: "/admin/parametres", label: "Paramètres", icon: Settings, dirigeantOnly: true },
  { to: "/admin/journal", label: "Journal d'activité", icon: History, dirigeantOnly: true },
];

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const { hasRole, isDirigeant } = useAuth();
  const items = navigation.filter((item) => (item.dirigeantOnly ? isDirigeant : !item.roles || hasRole(...item.roles)));

  return (
    <nav className="space-y-1">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/admin"}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive ? "bg-accent text-accent-foreground" : "text-primary-foreground/80 hover:bg-white/10 hover:text-primary-foreground",
            )
          }
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
        <span className="font-display text-lg font-bold text-accent-foreground">BD</span>
      </div>
      <div>
        <p className="font-display font-bold leading-tight text-primary-foreground">Borom Daradji</p>
        <p className="text-xs text-primary-foreground/60">Back-office</p>
      </div>
    </div>
  );
}

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const onLogout = async () => {
    await logout();
    navigate("/admin/connexion");
  };

  const footer = (
    <div className="space-y-2 border-t border-white/10 pt-4">
      <div className="px-3">
        <p className="truncate text-sm font-medium text-primary-foreground">{user?.name}</p>
        <p className="truncate text-xs text-primary-foreground/60">{user?.roles.map((r) => r.label).join(", ")}</p>
      </div>
      <button
        type="button"
        onClick={() => setPasswordOpen(true)}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-primary-foreground/80 hover:bg-white/10"
      >
        <KeyRound className="h-4 w-4" /> Mot de passe
      </button>
      <button
        type="button"
        onClick={onLogout}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-primary-foreground/80 hover:bg-white/10"
      >
        <LogOut className="h-4 w-4" /> Se déconnecter
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30">
      <Helmet>
        <title>Back-office | Borom Daradji</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      {/* Ordinateur : menu fixe à gauche. */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col justify-between bg-navy p-4 lg:flex">
        <div className="space-y-8">
          <Brand />
          <Navigation />
        </div>
        {footer}
      </aside>

      {/* Téléphone : barre en haut et menu coulissant. */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-navy px-4 py-3 lg:hidden">
        <Brand />
        <Button variant="ghost" size="icon" className="text-primary-foreground" onClick={() => setMobileOpen(true)} aria-label="Ouvrir le menu">
          <Menu className="h-6 w-6" />
        </Button>
      </header>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="flex w-72 flex-col justify-between border-0 bg-navy p-4">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="space-y-8 pt-6">
            <Brand />
            <Navigation onNavigate={() => setMobileOpen(false)} />
          </div>
          {footer}
        </SheetContent>
      </Sheet>

      <main className="px-4 py-6 lg:ml-64 lg:px-8 lg:py-8">
        <Outlet />
      </main>

      <PasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
}
