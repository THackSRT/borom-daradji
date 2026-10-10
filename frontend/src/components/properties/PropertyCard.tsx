import { Link } from 'react-router-dom';
import { MapPin, Maximize, BedDouble, Bath } from 'lucide-react';
import { Property, formatPrice } from '@/data/properties';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PropertyCardProps {
  property: Property;
}

export function PropertyCard({ property }: PropertyCardProps) {
  return (
    <Link to={`/biens/${property.slug}`}>
      <Card variant="property" className="h-full">
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden">
          <img
            src={property.images[0]}
            alt={property.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-navy/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          {/* Badges */}
          <div className="absolute top-4 left-4 flex gap-2">
            <Badge variant={property.transaction === 'vente' ? 'default' : 'secondary'}>
              {property.transaction === 'vente' ? 'Vente' : 'Location'}
            </Badge>
            {property.featured && (
              <Badge variant="gold">
                En vedette
              </Badge>
            )}
          </div>

          {/* Price tag */}
          <div className="absolute bottom-4 left-4 right-4">
            <p className="text-primary-foreground font-display font-bold text-xl drop-shadow-lg">
              {formatPrice(property.price, property.transaction)}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-3">
          <div>
            <h3 className="font-display font-semibold text-lg text-foreground line-clamp-2 group-hover:text-accent transition-colors">
              {property.title}
            </h3>
            <p className="flex items-center gap-1.5 text-muted-foreground text-sm mt-1">
              <MapPin className="h-4 w-4" />
              {property.location.neighborhood}, {property.location.city}
            </p>
          </div>

          {/* Features */}
          <div className="flex items-center gap-4 pt-2 border-t border-border">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Maximize className="h-4 w-4" />
              <span>{property.surface} m²</span>
            </div>
            {property.bedrooms > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <BedDouble className="h-4 w-4" />
                <span>{property.bedrooms} ch.</span>
              </div>
            )}
            {property.bathrooms > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Bath className="h-4 w-4" />
                <span>{property.bathrooms} sdb</span>
              </div>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
