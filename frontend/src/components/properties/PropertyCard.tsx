import { Link } from "react-router-dom";
import { Bath, BedDouble, Home, MapPin, Maximize } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatPrice, type PublicProperty } from "@/lib/public";

export function PropertyCard({ property }: { property: PublicProperty }) {
  const place = [property.neighborhood, property.city].filter(Boolean).join(", ");

  return (
    <Link to={`/biens/${property.slug}`}>
      <Card variant="property" className="h-full">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {property.cover_url ? (
            <img src={property.cover_url} alt={property.title} loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
          ) : (
            <div className="flex h-full items-center justify-center"><Home className="h-10 w-10 text-muted-foreground/40" /></div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-navy/70 via-transparent to-transparent" />

          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
            <Badge variant={property.transaction.value === "vente" ? "default" : "secondary"}>
              {property.transaction.value === "vente" ? "Vente" : "Location"}
            </Badge>
            {property.status.value === "en_negociation" && <Badge className="border-transparent bg-amber-500 text-white">En négociation</Badge>}
            {property.is_featured && property.status.value !== "en_negociation" && <Badge variant="gold">En vedette</Badge>}
          </div>

          <div className="absolute bottom-4 left-4 right-4">
            <p className="font-display text-xl font-bold text-primary-foreground drop-shadow-lg">{formatPrice(property)}</p>
          </div>
        </div>

        <div className="space-y-3 p-5">
          <div>
            <h3 className="line-clamp-2 font-display text-lg font-semibold text-foreground transition-colors group-hover:text-accent">{property.title}</h3>
            {place && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{place}</p>
            )}
          </div>
          <div className="flex items-center gap-4 border-t border-border pt-2 text-sm text-muted-foreground">
            {property.surface && <span className="flex items-center gap-1.5"><Maximize className="h-4 w-4" />{property.surface} m²</span>}
            {!!property.bedrooms && <span className="flex items-center gap-1.5"><BedDouble className="h-4 w-4" />{property.bedrooms} ch.</span>}
            {!!property.bathrooms && <span className="flex items-center gap-1.5"><Bath className="h-4 w-4" />{property.bathrooms} sdb</span>}
            <span className="ml-auto text-xs">{property.type.label}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export function PropertyCardSkeleton() {
  return (
    <div className="h-full overflow-hidden rounded-xl bg-card shadow-md">
      <div className="aspect-[4/3] animate-pulse bg-muted" />
      <div className="space-y-3 p-5">
        <div className="h-5 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
