import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Article } from "../types";
import { qty, searchArticles } from "../stock";
import { cfa } from "./billing";

/** Ajout d'un article à une liste (achat, sortie, vente) : recherche par nom, référence ou emplacement. */
export function ArticlePicker({ onPick, exclude = [], inStock = false, label = "Ajouter un article", showPrice = false }: {
  onPick: (article: Article) => void;
  exclude?: number[];
  inStock?: boolean;
  label?: string;
  showPrice?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const { data = [], isFetching } = useQuery({
    queryKey: ["article-picker", term, inStock],
    queryFn: () => searchArticles(term, inStock ? { in_stock: 1 } : {}),
    enabled: open,
  });
  const list = data.filter((a) => !exclude.includes(a.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-start border-dashed text-muted-foreground"><Plus className="h-4 w-4" /> {label}</Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Ciment, fer de 10, CIM-50…" value={term} onValueChange={setTerm} />
          <CommandList>
            <CommandEmpty>{isFetching ? "Recherche…" : "Aucun article."}</CommandEmpty>
            <CommandGroup>
              {list.map((a) => (
                <CommandItem key={a.id} value={String(a.id)} onSelect={() => { onPick(a); setOpen(false); setTerm(""); }}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{a.name}</span>
                    <span className="text-xs text-muted-foreground">{a.reference}{showPrice ? ` · ${cfa(a.sale_price)}/${a.unit}` : ""}</span>
                  </span>
                  <span className={cn("ml-2 shrink-0 text-xs tabular-nums", a.quantity <= 0 ? "text-red-600" : a.is_low ? "text-orange-600" : "text-muted-foreground")}>{qty(a.quantity)} {a.unit}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
