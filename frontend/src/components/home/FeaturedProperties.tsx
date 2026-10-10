import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PropertyCard } from '@/components/properties/PropertyCard';
import { getFeaturedProperties } from '@/data/properties';

export function FeaturedProperties() {
  const featuredProperties = getFeaturedProperties().slice(0, 6);

  return (
    <section className="py-20">
      <div className="container">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-12">
          <div>
            <p className="text-accent font-semibold mb-3 uppercase tracking-wider text-sm">
              Nos Biens en Vedette
            </p>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground">
              Découvrez nos meilleures offres
            </h2>
          </div>
          <Link to="/biens">
            <Button variant="gold-outline" size="lg">
              Voir tous les biens
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>

        {/* Properties grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {featuredProperties.map((property, index) => (
            <div 
              key={property.id}
              className="animate-fade-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <PropertyCard property={property} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
