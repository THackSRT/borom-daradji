import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Building2, CalendarDays, ClipboardList, LayoutDashboard, Plus, User as UserIcon } from "lucide-react";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import type { Client, Paginated, Property } from "../types";
import { useQuickCreate } from "./QuickCreate";
import { StatusBadge } from "./ui";

function useDebounced<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** Recherche globale (Ctrl+K) : clients par nom ou téléphone, biens par titre ou référence, raccourcis. */
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
    queryFn: async () => {
      const [clients, properties] = await Promise.all([
        api<Paginated<Client>>("/clients", { query: { search: term, per_page: 5 } }),
        api<Paginated<Property>>("/properties", { query: { search: term, per_page: 5 } }),
      ]);
      return { clients: clients.data, properties: properties.data };
    },
    enabled: open && term.length >= 2,
  });

  const go = (path: string) => { onOpenChange(false); setSearch(""); navigate(path); };
  const create = (kind: "property" | "client" | "task") => { onOpenChange(false); quickCreate.open(kind); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[20%] translate-y-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">Recherche</DialogTitle>
        {/* Filtrage fait par l'API (un numéro « 77 123 » doit trouver « +22177123… ») : cmdk ne filtre pas. */}
        <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:gap-2 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2.5 [&_[cmdk-item]_svg]:h-4 [&_[cmdk-item]_svg]:w-4">
      <CommandInput placeholder="Rechercher un client, un numéro, un bien, une référence…" value={search} onValueChange={setSearch} />
      <CommandList>
        {term.length >= 2 && data && !data.clients.length && !data.properties.length && (
          <p className="py-6 text-center text-sm text-muted-foreground">Aucun client ni bien pour « {term} ».</p>
        )}
        {!!data?.clients.length && (
          <CommandGroup heading="Clients">
            {data.clients.map((c) => (
              <CommandItem key={`c${c.id}`} value={`client-${c.id}-${c.name}-${c.phone}`} onSelect={() => go(`/admin/clients/${c.id}`)}>
                <UserIcon className="text-muted-foreground" />
                <span className="flex-1">{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.phone}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {!!data?.properties.length && (
          <CommandGroup heading="Biens">
            {data.properties.map((p) => (
              <CommandItem key={`p${p.id}`} value={`bien-${p.id}-${p.reference}-${p.title}`} onSelect={() => go(`/admin/biens/${p.id}`)}>
                <Building2 className="text-muted-foreground" />
                <span className="flex-1 truncate">{p.title}</span>
                <span className="hidden text-xs text-muted-foreground sm:inline">{formatPrice(p.price, p.transaction.value === "location")}</span>
                <StatusBadge option={p.status} />
              </CommandItem>
            ))}
          </CommandGroup>
        )}
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
