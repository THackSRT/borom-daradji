import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Search, SlidersHorizontal, Grid3X3, List, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { PropertyCard } from '@/components/properties/PropertyCard';
import { properties, propertyTypes, transactionTypes, cities, neighborhoods } from '@/data/properties';

export default function PropertiesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Filters from URL
  const type = searchParams.get('type') || '';
  const transaction = searchParams.get('transaction') || '';
  const city = searchParams.get('city') || '';
  const neighborhood = searchParams.get('neighborhood') || '';
  const priceMin = searchParams.get('priceMin') || '';
  const priceMax = searchParams.get('priceMax') || '';
  const surfaceMin = searchParams.get('surfaceMin') || '';
  const search = searchParams.get('search') || '';

  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const filteredProperties = useMemo(() => {
    return properties.filter((property) => {
      if (type && property.type !== type) return false;
      if (transaction && property.transaction !== transaction) return false;
      if (city && property.location.city !== city) return false;
      if (neighborhood && property.location.neighborhood !== neighborhood) return false;
      if (priceMin && property.price < parseInt(priceMin)) return false;
      if (priceMax && property.price > parseInt(priceMax)) return false;
      if (surfaceMin && property.surface < parseInt(surfaceMin)) return false;
      if (search && !property.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [type, transaction, city, neighborhood, priceMin, priceMax, surfaceMin, search]);

  const hasActiveFilters = type || transaction || city || neighborhood || priceMin || priceMax || surfaceMin || search;

  const FiltersContent = () => (
    <div className="space-y-6">
      {/* Search */}
      <div>
        <label className="text-sm font-medium mb-2 block">Rechercher</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Mot-clé..."
            value={search}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Transaction */}
      <div>
        <label className="text-sm font-medium mb-2 block">Transaction</label>
        <Select value={transaction || "all"} onValueChange={(v) => updateFilter('transaction', v === "all" ? "" : v)}>
          <SelectTrigger>
            <SelectValue placeholder="Tous" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            {transactionTypes.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Type */}
      <div>
        <label className="text-sm font-medium mb-2 block">Type de bien</label>
        <Select value={type || "all"} onValueChange={(v) => updateFilter('type', v === "all" ? "" : v)}>
          <SelectTrigger>
            <SelectValue placeholder="Tous" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            {propertyTypes.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* City */}
      <div>
        <label className="text-sm font-medium mb-2 block">Ville</label>
        <Select value={city || "all"} onValueChange={(v) => updateFilter('city', v === "all" ? "" : v)}>
          <SelectTrigger>
            <SelectValue placeholder="Toutes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes</SelectItem>
            {cities.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Neighborhood */}
      <div>
        <label className="text-sm font-medium mb-2 block">Quartier</label>
        <Select value={neighborhood || "all"} onValueChange={(v) => updateFilter('neighborhood', v === "all" ? "" : v)}>
          <SelectTrigger>
            <SelectValue placeholder="Tous" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            {neighborhoods.map((n) => (
              <SelectItem key={n} value={n}>{n}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Price */}
      <div>
        <label className="text-sm font-medium mb-2 block">Budget maximum</label>
        <Select value={priceMax || "all"} onValueChange={(v) => updateFilter('priceMax', v === "all" ? "" : v)}>
          <SelectTrigger>
            <SelectValue placeholder="Pas de limite" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Pas de limite</SelectItem>
            <SelectItem value="50000000">50 000 000 FCFA</SelectItem>
            <SelectItem value="100000000">100 000 000 FCFA</SelectItem>
            <SelectItem value="200000000">200 000 000 FCFA</SelectItem>
            <SelectItem value="500000000">500 000 000 FCFA</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Surface */}
      <div>
        <label className="text-sm font-medium mb-2 block">Surface minimum</label>
        <Select value={surfaceMin || "all"} onValueChange={(v) => updateFilter('surfaceMin', v === "all" ? "" : v)}>
          <SelectTrigger>
            <SelectValue placeholder="Pas de minimum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Pas de minimum</SelectItem>
            <SelectItem value="50">50 m²</SelectItem>
            <SelectItem value="100">100 m²</SelectItem>
            <SelectItem value="200">200 m²</SelectItem>
            <SelectItem value="500">500 m²</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Clear filters */}
      {hasActiveFilters && (
        <Button variant="outline" className="w-full" onClick={clearFilters}>
          <X className="h-4 w-4 mr-2" />
          Effacer les filtres
        </Button>
      )}
    </div>
  );

  return (
    <>
      <Helmet>
        <title>Nos Biens Immobiliers | Borom Daradji - Dakar, Sénégal</title>
        <meta name="description" content="Découvrez notre sélection de biens immobiliers à Dakar et au Sénégal : villas, appartements, terrains, maisons à vendre ou à louer." />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="bg-navy py-16">
          <div className="container">
            <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground mb-4">
              Nos Biens Immobiliers
            </h1>
            <p className="text-primary-foreground/80 text-lg max-w-2xl">
              Découvrez notre sélection de biens de qualité à Dakar et dans tout le Sénégal.
            </p>
          </div>
        </div>

        <div className="container py-8">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Desktop Filters Sidebar */}
            <aside className="hidden lg:block w-72 flex-shrink-0">
              <div className="sticky top-32 bg-card rounded-xl border p-6">
                <h2 className="font-display font-semibold text-lg mb-6">Filtres</h2>
                <FiltersContent />
              </div>
            </aside>

            {/* Main content */}
            <div className="flex-1">
              {/* Toolbar */}
              <div className="flex items-center justify-between mb-6 gap-4">
                <p className="text-muted-foreground">
                  <span className="font-semibold text-foreground">{filteredProperties.length}</span> bien(s) trouvé(s)
                </p>

                <div className="flex items-center gap-2">
                  {/* Mobile filters */}
                  <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                    <SheetTrigger asChild>
                      <Button variant="outline" className="lg:hidden">
                        <SlidersHorizontal className="h-4 w-4 mr-2" />
                        Filtres
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-80">
                      <SheetHeader>
                        <SheetTitle>Filtres</SheetTitle>
                      </SheetHeader>
                      <div className="mt-6">
                        <FiltersContent />
                      </div>
                    </SheetContent>
                  </Sheet>

                  {/* View toggle */}
                  <div className="flex border rounded-lg overflow-hidden">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`p-2 ${viewMode === 'grid' ? 'bg-accent text-accent-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                    >
                      <Grid3X3 className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => setViewMode('list')}
                      className={`p-2 ${viewMode === 'list' ? 'bg-accent text-accent-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
                    >
                      <List className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Properties grid/list */}
              {filteredProperties.length > 0 ? (
                <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}>
                  {filteredProperties.map((property, index) => (
                    <div 
                      key={property.id}
                      className="animate-fade-up"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <PropertyCard property={property} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <p className="text-muted-foreground text-lg mb-4">
                    Aucun bien ne correspond à vos critères.
                  </p>
                  <Button variant="outline" onClick={clearFilters}>
                    Réinitialiser les filtres
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
