import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Boxes, Building2, CalendarDays, ClipboardList, FileSignature, HardHat, LayoutDashboard, Plus, Receipt, ShoppingCart, User as UserIcon } from "lucide-react";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import type { Option } from "../types";
import { useQuickCreate } from "./QuickCreate";
import { StatusBadge } from "./ui";

type GroupKey = "clients" | "properties" | "worksites" | "quotes" | "invoices" | "articles" | "purchases";
interface SearchItem { id: number; title: string; subtitle: string | null; url: string; status: Option | null }

const GROUPS: Record<GroupKey, { label: string; icon: typeof UserIcon }> = {
  clients: { label: "Clients", icon: UserIcon },
  properties: { label: "Biens", icon: Building2 },
  worksites: { label: "Chantiers", icon: HardHat },
  quotes: { label: "Devis", icon: FileSignature },
  invoices: { label: "Factures", icon: Receipt },
  articles: { label: "Articles du stock", icon: Boxes },
  purchases: { label: "Achats", icon: ShoppingCart },
};

function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** Recherche globale (Ctrl+K) : clients, biens, chantiers, devis, factures, articles, achats (selon les droits), raccourcis. */
export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const quickCreate = useQuickCreate();
  const [search, setSearch] = useState("");
  const term = useDebounced(search.trim());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const { data } = useQuery({
    queryKey: ["global-search", term],
    queryFn: () => api<{ data: Partial<Record<GroupKey, SearchItem[]>> }>("/search", { query: { q: term } }).then((r) => r.data),
    enabled: open && term.length >= 2,
  });
  const groups = (Object.keys(GROUPS) as GroupKey[]).filter((k) => data?.[k]?.length);

  const go = (path: string) => { onOpenChange(false); setSearch(""); navigate(path); };
  const create = (kind: "property" | "client" | "task") => { onOpenChange(false); quickCreate.open(kind); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[20%] translate-y-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">Recherche</DialogTitle>
        {/* Filtrage fait par l'API (un numéro « 77 123 » doit trouver « +22177123… ») : cmdk ne filtre pas. */}
        <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:gap-2 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2.5 [&_[cmdk-item]_svg]:h-4 [&_[cmdk-item]_svg]:w-4">
      <CommandInput placeholder="Client, numéro, bien, chantier, facture, article…" value={search} onValueChange={setSearch} />
      <CommandList>
        {term.length >= 2 && data && !groups.length && (
          <p className="py-6 text-center text-sm text-muted-foreground">Aucun résultat pour « {term} ».</p>
        )}
        {groups.map((key) => {
          const { label, icon: Icon } = GROUPS[key];
          return (
            <CommandGroup key={key} heading={label}>
              {data![key]!.map((item) => (
                <CommandItem key={`${key}-${item.id}`} value={`${key}-${item.id}-${item.title}`} onSelect={() => go(item.url)}>
                  <Icon className="text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{item.title}</span>
                    {item.subtitle && <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>}
                  </span>
                  {item.status && <StatusBadge option={item.status} />}
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem value="action-nouveau-client" onSelect={() => create("client")}><Plus className="text-muted-foreground" /> Nouveau client</CommandItem>
          <CommandItem value="action-nouveau-bien" onSelect={() => create("property")}><Plus className="text-muted-foreground" /> Nouveau bien</CommandItem>
          <CommandItem value="action-nouvelle-tache" onSelect={() => create("task")}><Plus className="text-muted-foreground" /> Nouvelle tâche</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Aller à">
          <CommandItem value="page-accueil" onSelect={() => go("/admin")}><LayoutDashboard className="text-muted-foreground" /> Accueil</CommandItem>
          <CommandItem value="page-taches" onSelect={() => go("/admin/taches")}><ClipboardList className="text-muted-foreground" /> Tâches</CommandItem>
          <CommandItem value="page-visites" onSelect={() => go("/admin/visites")}><CalendarDays className="text-muted-foreground" /> Visites</CommandItem>
        </CommandGroup>
      </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
