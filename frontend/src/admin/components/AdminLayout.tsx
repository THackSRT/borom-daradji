import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  Building2,
  CalendarDays,
  Globe,
  ChevronsUpDown,
  ClipboardList,
  History,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { initials, useSite } from "@/lib/site";
import { useAuth } from "../auth";
import type { RoleValue } from "../types";
import { GlobalSearch } from "./GlobalSearch";
import { PasswordDialog } from "./PasswordDialog";
import { QuickCreateProvider, useQuickCreate } from "./QuickCreate";
import { Avatar } from "./ui";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles?: RoleValue[];
  dirigeantOnly?: boolean;
}

const sections: { title: string; items: NavItem[] }[] = [
  {
    title: "Au quotidien",
    items: [
      { to: "/admin", label: "Accueil", icon: LayoutDashboard },
      { to: "/admin/taches", label: "Tâches", icon: ClipboardList },
      { to: "/admin/visites", label: "Visites", icon: CalendarDays, roles: ["agent", "commercial"] },
    ],
  },
  {
    title: "Portefeuille",
    items: [
      { to: "/admin/biens", label: "Biens", icon: Building2 },
      { to: "/admin/clients", label: "Clients", icon: Users },
    ],
  },
  {
    title: "Administration",
    items: [
      { to: "/admin/comptes", label: "Comptes", icon: UserCog, dirigeantOnly: true },
      { to: "/admin/site", label: "Site internet", icon: Globe, dirigeantOnly: true },
      { to: "/admin/parametres", label: "Paramètres", icon: Settings, dirigeantOnly: true },
      { to: "/admin/journal", label: "Journal d'activité", icon: History, dirigeantOnly: true },
    ],
  },
];

function useVisibleSections() {
  const { hasRole, isDirigeant } = useAuth();
  return sections
    .map((s) => ({ ...s, items: s.items.filter((i) => (i.dirigeantOnly ? isDirigeant : !i.roles || hasRole(...i.roles))) }))
    .filter((s) => s.items.length);
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const visible = useVisibleSections();
  return (
    <nav className="space-y-6">
      {visible.map((section) => (
        <div key={section.title}>
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{section.title}</p>
          <div className="space-y-0.5">
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/admin"}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function Brand() {
  const { data: site } = useSite();
  const name = site?.company.trade_name ?? "Borom Daradji";
  const logo = site?.company.logo_url;
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {logo ? (
        <img src={logo} alt="" className="h-9 w-auto max-w-[4.5rem] flex-shrink-0 object-contain" />
      ) : (
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-navy shadow-sm">
          <span className="font-display text-base font-bold text-gold">{initials(name)}</span>
        </div>
      )}
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">Espace agence</p>
      </div>
    </div>
  );
}

function UserMenu({ onPassword }: { onPassword: () => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-muted">
        <Avatar name={user.name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{user.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{user.roles.map((r) => r.label).join(", ")}</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-medium">{user.name}</span>
          <span className="block text-xs text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onPassword}><KeyRound className="mr-2 h-4 w-4" /> Changer de mot de passe</DropdownMenuItem>
        <DropdownMenuItem onClick={async () => { await logout(); navigate("/admin/connexion"); }}>
          <LogOut className="mr-2 h-4 w-4" /> Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CreateMenu({ compact = false }: { compact?: boolean }) {
  const { open } = useQuickCreate();
  const { hasRole } = useAuth();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={compact ? "icon" : "sm"} aria-label="Créer">
          <Plus className="h-4 w-4" />
          {!compact && "Créer"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => open("client")}><Users className="mr-2 h-4 w-4" /> Un client</DropdownMenuItem>
        {hasRole("agent") && <DropdownMenuItem onClick={() => open("property")}><Building2 className="mr-2 h-4 w-4" /> Un bien</DropdownMenuItem>}
        <DropdownMenuItem onClick={() => open("task")}><ClipboardList className="mr-2 h-4 w-4" /> Une tâche</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Barre de navigation en bas de l'écran sur téléphone : les 4 écrans les plus utilisés à une main. */
function BottomNav({ onMore }: { onMore: () => void }) {
  const items = [
    { to: "/admin", label: "Accueil", icon: LayoutDashboard },
    { to: "/admin/taches", label: "Tâches", icon: ClipboardList },
    { to: "/admin/biens", label: "Biens", icon: Building2 },
    { to: "/admin/clients", label: "Clients", icon: Users },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.to === "/admin"}
          className={({ isActive }) => cn("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", isActive ? "text-primary" : "text-muted-foreground")}>
          <item.icon className="h-5 w-5" />
          {item.label}
        </NavLink>
      ))}
      <button type="button" onClick={onMore} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground">
        <Menu className="h-5 w-5" /> Plus
      </button>
    </nav>
  );
}

function Shell() {
  const location = useLocation();
  const siteName = useSite().data?.company.trade_name ?? "Borom Daradji";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const searchButton = (
    <button
      type="button"
      onClick={() => setSearchOpen(true)}
      className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border bg-muted/40 px-3 text-sm text-muted-foreground transition hover:bg-muted"
    >
      <Search className="h-4 w-4" />
      <span className="flex-1 text-left">Rechercher un client, un bien…</span>
      <kbd className="hidden rounded border bg-card px-1.5 text-[10px] font-medium sm:inline">Ctrl K</kbd>
    </button>
  );

  return (
    <div className="admin min-h-screen bg-slate-50">
      <Helmet>
        <title>{`Espace agence | ${siteName}`}</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      {/* Ordinateur : menu fixe à gauche. */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r bg-card lg:flex">
        <div className="flex h-16 items-center border-b px-5"><Brand /></div>
        <div className="flex-1 overflow-y-auto px-3 py-5"><Navigation /></div>
        <div className="border-t p-3"><UserMenu onPassword={() => setPasswordOpen(true)} /></div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-card/90 px-4 backdrop-blur lg:px-8">
          <div className="lg:hidden"><Brand /></div>
          <div className="hidden flex-1 lg:block">{searchButton}</div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSearchOpen(true)} aria-label="Rechercher"><Search className="h-5 w-5" /></Button>
            <CreateMenu compact={false} />
          </div>
        </header>

        <main key={location.pathname} className="mx-auto max-w-7xl animate-fade-in px-4 py-6 pb-24 lg:px-8 lg:py-8 lg:pb-8">
          <Outlet />
        </main>
      </div>

      <BottomNav onMore={() => setMobileOpen(true)} />
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="flex w-72 flex-col p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="flex h-16 items-center border-b px-5"><Brand /></div>
          <div className="flex-1 overflow-y-auto px-3 py-5"><Navigation onNavigate={() => setMobileOpen(false)} /></div>
          <div className="border-t p-3"><UserMenu onPassword={() => { setMobileOpen(false); setPasswordOpen(true); }} /></div>
        </SheetContent>
      </Sheet>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <PasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
}

export function AdminLayout() {
  return (
    <QuickCreateProvider>
      <Shell />
    </QuickCreateProvider>
  );
}
