import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PropertyCard, PropertyCardSkeleton } from "@/components/properties/PropertyCard";
import { budgetOptions, propertyTypes, transactionTypes, useCatalog, usePlaces } from "@/lib/public";

const FILTERS = ["type", "transaction", "city", "neighborhood", "priceMax", "surfaceMin", "search", "sort"] as const;
type FilterKey = (typeof FILTERS)[number];

const sorts = [
  { value: "recent", label: "Plus récents" },
  { value: "price_asc", label: "Prix croissant" },
  { value: "price_desc", label: "Prix décroissant" },
  { value: "surface_desc", label: "Plus grande surface" },
];

export default function PropertiesPage() {
  const [params, setParams] = useSearchParams();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const { data: places } = usePlaces();

  const filters = Object.fromEntries(FILTERS.map((k) => [k, params.get(k) ?? ""])) as Record<FilterKey, string>;
  const page = Number(params.get("page") ?? 1) || 1;
  const { data, isLoading, isFetching } = useCatalog({ ...filters, page, per_page: 12 });

  const update = (key: FilterKey, value: string) => {
    const next = new URLSearchParams(params);
    if (value && value !== "all") next.set(key, value); else next.delete(key);
    // Changer de ville vide le quartier ; changer de transaction vide le budget (vente ≠ loyer).
    if (key === "city") next.delete("neighborhood");
    if (key === "transaction") next.delete("priceMax");
    next.delete("page");
    setParams(next);
  };
  const goTo = (p: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(p));
    setParams(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const clear = () => setParams(new URLSearchParams());

  const neighborhoods = places?.find((p) => p.city === filters.city)?.neighborhoods ?? places?.flatMap((p) => p.neighborhoods) ?? [];
  const active = FILTERS.some((k) => k !== "sort" && filters[k]);
  const total = data?.meta.total ?? 0;

  const select = (key: FilterKey, label: string, placeholder: string, options: { value: string; label: string }[]) => (
    <div>
      <label className="mb-2 block text-sm font-medium">{label}</label>
      <Select value={filters[key] || "all"} onValueChange={(v) => update(key, v)}>
        <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{placeholder}</SelectItem>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  const filtersContent = (
    <div className="space-y-6">
      <div>
        <label className="mb-2 block text-sm font-medium">Rechercher</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input key={filters.search} placeholder="Quartier, type, référence…" defaultValue={filters.search} className="pl-10"
            onKeyDown={(e) => e.key === "Enter" && update("search", e.currentTarget.value)}
            onBlur={(e) => e.target.value !== filters.search && update("search", e.target.value)} />
        </div>
      </div>
      {select("transaction", "Transaction", "Vente et location", transactionTypes)}
      {select("type", "Type de bien", "Tous les types", propertyTypes)}
      {select("city", "Ville", "Toutes les villes", (places ?? []).map((p) => ({ value: p.city, label: p.city })))}
      {select("neighborhood", "Quartier", "Tous les quartiers", neighborhoods.map((n) => ({ value: n, label: n })))}
      {select("priceMax", filters.transaction === "location" ? "Loyer maximum" : "Budget maximum", "Pas de limite", budgetOptions(filters.transaction))}
      {select("surfaceMin", "Surface minimum", "Pas de minimum", ["50", "100", "200", "500"].map((v) => ({ value: v, label: `${v} m²` })))}
      {active && (
        <Button variant="outline" className="w-full" onClick={clear}><X className="mr-2 h-4 w-4" /> Effacer les filtres</Button>
      )}
    </div>
  );

  return (
    <>
      <Helmet>
        <title>Nos biens immobiliers</title>
        <meta name="description" content="Villas, appartements, terrains et maisons à vendre ou à louer à Dakar et au Sénégal. Biens vérifiés par l'agence Borom Daradji." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="bg-navy py-16">
          <div className="container">
            <h1 className="mb-4 font-display text-3xl font-bold text-primary-foreground md:text-4xl lg:text-5xl">Nos biens immobiliers</h1>
            <p className="max-w-2xl text-lg text-primary-foreground/80">
              Chaque bien publié a fait l'objet d'une vérification foncière par notre équipe.
            </p>
          </div>
        </div>

        <div className="container py-8">
          <div className="flex flex-col gap-8 lg:flex-row">
            <aside className="hidden w-72 flex-shrink-0 lg:block">
              <div className="sticky top-32 rounded-xl border bg-card p-6">
                <h2 className="mb-6 font-display text-lg font-semibold">Filtres</h2>
                {filtersContent}
              </div>
            </aside>

            <div className="flex-1">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <p className="text-muted-foreground">
                  <span className="font-semibold text-foreground">{isLoading ? "…" : total}</span> bien{total > 1 ? "s" : ""} trouvé{total > 1 ? "s" : ""}
                </p>
                <div className="flex items-center gap-2">
                  <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                    <SheetTrigger asChild>
                      <Button variant="outline" className="lg:hidden"><SlidersHorizontal className="mr-2 h-4 w-4" /> Filtres</Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-80 overflow-y-auto">
                      <SheetHeader><SheetTitle>Filtres</SheetTitle></SheetHeader>
                      <div className="mt-6">{filtersContent}</div>
                    </SheetContent>
                  </Sheet>
                  <Select value={filters.sort || "recent"} onValueChange={(v) => update("sort", v === "recent" ? "" : v)}>
                    <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>{sorts.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              {isLoading ? (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <PropertyCardSkeleton key={i} />)}</div>
              ) : data && data.data.length > 0 ? (
                <>
                  <div className={`grid grid-cols-1 gap-6 transition-opacity md:grid-cols-2 xl:grid-cols-3 ${isFetching ? "opacity-60" : ""}`}>
                    {data.data.map((property, index) => (
                      <div key={property.slug} className="animate-fade-up" style={{ animationDelay: `${index * 50}ms` }}>
                        <PropertyCard property={property} />
                      </div>
                    ))}
                  </div>
                  {data.meta.last_page > 1 && (
                    <div className="mt-10 flex items-center justify-center gap-3">
                      <Button variant="outline" size="icon" disabled={page <= 1} onClick={() => goTo(page - 1)} aria-label="Page précédente"><ChevronLeft className="h-4 w-4" /></Button>
                      <span className="text-sm text-muted-foreground">Page {page} sur {data.meta.last_page}</span>
                      <Button variant="outline" size="icon" disabled={page >= data.meta.last_page} onClick={() => goTo(page + 1)} aria-label="Page suivante"><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-xl border border-dashed py-16 text-center">
                  <p className="mb-2 text-lg font-medium text-foreground">Aucun bien ne correspond à vos critères.</p>
                  <p className="mb-6 text-muted-foreground">Laissez-nous votre recherche : nous vous prévenons dès qu'un bien correspond.</p>
                  <div className="flex justify-center gap-3">
                    <Button variant="outline" onClick={clear}>Réinitialiser les filtres</Button>
                    <Button variant="gold" asChild><a href="/contact">Confier ma recherche</a></Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
