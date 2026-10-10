import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PropertyCard, PropertyCardSkeleton } from "@/components/properties/PropertyCard";
import { useCatalog } from "@/lib/public";

export function FeaturedProperties() {
  const featured = useCatalog({ featured: true, per_page: 6 });
  // Sans bien mis en avant par l'agence, on montre les plus récents.
  const recent = useCatalog({ per_page: 6 });
  const source = featured.data?.data.length ? featured : recent;
  const properties = source.data?.data ?? [];
  const loading = featured.isLoading || (!featured.data?.data.length && recent.isLoading);

  if (!loading && !properties.length) return null;

  return (
    <section className="py-20">
      <div className="container">
        <div className="mb-12 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-accent">Nos biens en vedette</p>
            <h2 className="font-display text-3xl font-bold text-foreground md:text-4xl lg:text-5xl">Découvrez nos meilleures offres</h2>
          </div>
          <Link to="/biens">
            <Button variant="gold-outline" size="lg">Voir tous les biens <ArrowRight className="h-5 w-5" /></Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 3 }, (_, i) => <PropertyCardSkeleton key={i} />)
            : properties.map((property, index) => (
                <div key={property.slug} className="animate-fade-up" style={{ animationDelay: `${index * 100}ms` }}>
                  <PropertyCard property={property} />
                </div>
              ))}
        </div>
      </div>
    </section>
  );
}
