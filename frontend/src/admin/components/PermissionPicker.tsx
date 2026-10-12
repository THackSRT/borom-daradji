/**
 * Choix des permissions, regroupées par module : case par permission, case « tout le module »,
 * recherche, droits hérités d'un rôle (affichés cochés et grisés) et droits non attribuables.
 */
import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { PermissionModule } from "../types";

export function PermissionPicker({
  modules,
  value,
  onChange,
  readOnly = false,
  inherited = {},
  locked,
}: {
  modules: PermissionModule[];
  value: string[];
  onChange?: (next: string[]) => void;
  readOnly?: boolean;
  /** Permission → rôles qui la donnent déjà (fiche d'un compte). */
  inherited?: Record<string, string[]>;
  /** Raison pour laquelle une permission ne peut pas être cochée (null : libre). */
  locked?: (name: string) => string | null;
}) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const selected = useMemo(() => new Set(value), [value]);
  const term = search.trim().toLowerCase();

  const visible = modules
    .map((m) => ({
      ...m,
      permissions: m.permissions.filter((p) => !term || `${p.label} ${p.description ?? ""} ${m.label}`.toLowerCase().includes(term)),
    }))
    .filter((m) => m.permissions.length);

  const set = (names: string[], on: boolean) => {
    if (!onChange) return;
    const next = new Set(selected);
    names.forEach((n) => (on ? next.add(n) : next.delete(n)));
    onChange([...next].sort());
  };
  const editable = (name: string) => !readOnly && !inherited[name]?.length && !locked?.(name);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="bg-card pl-9" placeholder="Chercher un droit (ex. facture, pièce, caisse…)" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      {visible.map((module) => {
        const names = module.permissions.map((p) => p.name);
        const effective = names.filter((n) => selected.has(n) || inherited[n]?.length);
        const toggleable = names.filter(editable);
        const allOn = toggleable.length > 0 && toggleable.every((n) => selected.has(n));
        const someOn = toggleable.some((n) => selected.has(n));
        const isCollapsed = collapsed[module.key] && !term;
        return (
          <section key={module.key} className="overflow-hidden rounded-lg border bg-card">
            <header className="flex items-center gap-3 border-b bg-muted/30 px-4 py-2.5">
              {!readOnly && (
                <Checkbox
                  checked={allOn ? true : someOn ? "indeterminate" : false}
                  disabled={!toggleable.length}
                  onCheckedChange={(v) => set(toggleable, v === true)}
                  aria-label={`Tout le module ${module.label}`}
                />
              )}
              <button type="button" className="flex flex-1 items-center justify-between gap-2 text-left"
                onClick={() => setCollapsed((c) => ({ ...c, [module.key]: !c[module.key] }))} aria-expanded={!isCollapsed}>
                <span className="text-sm font-semibold">{module.label}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={cn("rounded-full px-2 py-0.5 tabular-nums", effective.length ? "bg-primary/10 text-primary" : "bg-muted")}>{effective.length}/{names.length}</span>
                  <ChevronDown className={cn("h-4 w-4 transition", !isCollapsed && "rotate-180")} />
                </span>
              </button>
            </header>
            {!isCollapsed && (
              <ul className="divide-y">
                {module.permissions.map((p) => {
                  const via = inherited[p.name] ?? [];
                  const reason = locked?.(p.name) ?? null;
                  const checked = selected.has(p.name) || via.length > 0;
                  return (
                    <li key={p.name}>
                      <label className={cn("flex items-start gap-3 px-4 py-2.5", editable(p.name) ? "cursor-pointer hover:bg-muted/30" : "cursor-default")}>
                        <Checkbox className="mt-0.5" checked={checked} disabled={!editable(p.name)}
                          onCheckedChange={(v) => set([p.name], v === true)} aria-label={p.label} />
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-sm", checked ? "font-medium" : "text-foreground/80")}>{p.label}</span>
                          {p.description && <span className="block text-xs text-muted-foreground">{p.description}</span>}
                          {via.length > 0 && <span className="mt-0.5 block text-xs text-primary">Donné par : {via.join(", ")}</span>}
                          {reason && !via.length && <span className="mt-0.5 block text-xs text-amber-700">{reason}</span>}
                        </span>
                        <code className="hidden shrink-0 text-[10px] text-muted-foreground/70 lg:block">{p.name}</code>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
      {!visible.length && <p className="py-6 text-center text-sm text-muted-foreground">Aucun droit ne correspond à « {search} ».</p>}
    </div>
  );
}
