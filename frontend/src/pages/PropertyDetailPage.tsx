import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  ArrowLeft, Bath, BedDouble, Check, ChevronLeft, ChevronRight, DoorOpen, Home, MapPin, Maximize, MessageCircle, Phone, Share2, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LeadForm } from "@/components/public/LeadForm";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { formatPhone, formatPrice, useCatalog, useCompany, usePublicProperty } from "@/lib/public";

export default function PropertyDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: property, isLoading, isError } = usePublicProperty(slug);
  const { data: company } = useCompany();
  const [index, setIndex] = useState(0);

  const similar = useCatalog({ type: property?.type.value, transaction: property?.transaction.value, per_page: 4 });

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="mb-8 aspect-[16/10] max-w-4xl animate-pulse rounded-2xl bg-muted" />
        <div className="h-8 w-1/2 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (isError || !property) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h1 className="mb-2 font-display text-2xl font-bold">Ce bien n'est plus disponible</h1>
          <p className="mb-6 text-muted-foreground">Il a peut-être été vendu ou loué. Découvrez nos autres biens.</p>
          <Link to="/biens"><Button variant="gold">Voir les biens disponibles</Button></Link>
        </div>
      </div>
    );
  }

  const photos = property.photos?.length ? property.photos : property.cover_url ? [property.cover_url] : [];
  const place = [property.neighborhood, property.city].filter(Boolean).join(", ");
  const isRental = property.transaction.value === "location";
  const others = similar.data?.data.filter((p) => p.slug !== property.slug).slice(0, 3) ?? [];

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: property.title, url });
      else { await navigator.clipboard.writeText(url); toast.success("Lien copié. Vous pouvez le partager."); }
    } catch {
      // Partage annulé par l'utilisateur.
    }
  };

  const facts = [
    { icon: Maximize, value: property.surface, label: "m² habitables" },
    { icon: Maximize, value: property.land_surface, label: "m² de terrain" },
    { icon: DoorOpen, value: property.rooms, label: "Pièces" },
    { icon: BedDouble, value: property.bedrooms, label: "Chambres" },
    { icon: Bath, value: property.bathrooms, label: "Salles de bain" },
  ].filter((f) => f.value);

  return (
    <>
      <Helmet>
        <title>{property.title} | Borom Daradji</title>
        <meta name="description" content={(property.description ?? property.title).substring(0, 160)} />
        <meta property="og:title" content={property.title} />
        {property.cover_url && <meta property="og:image" content={property.cover_url} />}
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="bg-muted/50 py-4">
          <div className="container flex items-center gap-2 overflow-hidden text-sm">
            <Link to="/" className="text-muted-foreground hover:text-foreground">Accueil</Link>
            <span className="text-muted-foreground">/</span>
            <Link to="/biens" className="text-muted-foreground hover:text-foreground">Nos biens</Link>
            <span className="text-muted-foreground">/</span>
            <span className="truncate font-medium text-foreground">{property.title}</span>
          </div>
        </div>

        <div className="container py-8">
          <Link to="/biens" className="mb-6 inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Retour aux biens
          </Link>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="min-w-0 space-y-8 lg:col-span-2">
              <div className="overflow-hidden rounded-2xl bg-muted">
                <div className="relative aspect-[16/10]">
                  {photos.length ? (
                    <img src={photos[index]} alt={property.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center"><Home className="h-16 w-16 text-muted-foreground/40" /></div>
                  )}
                  {photos.length > 1 && (
                    <>
                      <button onClick={() => setIndex((index - 1 + photos.length) % photos.length)} aria-label="Photo précédente"
                        className="absolute left-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm transition-colors hover:bg-background">
                        <ChevronLeft className="h-6 w-6" />
                      </button>
                      <button onClick={() => setIndex((index + 1) % photos.length)} aria-label="Photo suivante"
                        className="absolute right-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm transition-colors hover:bg-background">
                        <ChevronRight className="h-6 w-6" />
                      </button>
                      <span className="absolute bottom-4 right-4 rounded-full bg-black/60 px-3 py-1 text-xs text-white">{index + 1} / {photos.length}</span>
                    </>
                  )}
                  <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                    <Badge variant={isRental ? "secondary" : "default"}>{isRental ? "Location" : "Vente"}</Badge>
                    {property.status.value === "en_negociation" && <Badge className="border-transparent bg-amber-500 text-white">En négociation</Badge>}
                  </div>
                  <button onClick={share} aria-label="Partager ce bien"
                    className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm transition-colors hover:bg-background">
                    <Share2 className="h-5 w-5" />
                  </button>
                </div>
                {photos.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto p-4">
                    {photos.map((photo, i) => (
                      <button key={photo} onClick={() => setIndex(i)} aria-label={`Photo ${i + 1}`}
                        className={`h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-colors ${i === index ? "border-accent" : "border-transparent"}`}>
                        <img src={photo} alt="" className="h-full w-full object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 text-sm text-muted-foreground">{property.type.label} · Réf. {property.reference}</p>
                <h1 className="mb-3 font-display text-2xl font-bold text-foreground md:text-3xl lg:text-4xl">{property.title}</h1>
                {place && <p className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-5 w-5" />{place}</p>}
                <p className="mt-4 font-display text-3xl font-bold text-accent">{formatPrice(property)}</p>
                {isRental && (property.deposit_months || property.advance_months || property.charges) && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {[
                      property.deposit_months ? `Caution : ${property.deposit_months} mois` : null,
                      property.advance_months ? `Avance : ${property.advance_months} mois` : null,
                      property.charges ? `Charges : ${new Intl.NumberFormat("fr-FR").format(property.charges)} FCFA/mois` : null,
                    ].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>

              {facts.length > 0 && (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {facts.map((f) => (
                    <div key={f.label} className="rounded-xl bg-muted/50 p-4 text-center">
                      <f.icon className="mx-auto mb-2 h-6 w-6 text-accent" />
                      <p className="text-2xl font-bold text-foreground">{f.value}</p>
                      <p className="text-sm text-muted-foreground">{f.label}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-semibold text-foreground">Bien vérifié par l'agence</p>
                  <p className="text-sm text-muted-foreground">
                    Situation juridique : {property.land_status.label.toLowerCase()}. Identité du propriétaire, pièces du dossier et absence de litige connu
                    ont été contrôlées avant la mise en ligne.
                  </p>
                </div>
              </div>

              {property.description && (
                <div>
                  <h2 className="mb-4 font-display text-xl font-semibold">Description</h2>
                  <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{property.description}</p>
                </div>
              )}

              {property.features.length > 0 && (
                <div>
                  <h2 className="mb-4 font-display text-xl font-semibold">Équipements</h2>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {property.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10"><Check className="h-4 w-4 text-accent" /></div>
                        <span className="text-foreground">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <Card variant="elevated" className="lg:sticky lg:top-32">
                <CardContent className="space-y-4 p-6">
                  <div>
                    <h2 className="font-display text-xl font-semibold">Ce bien vous intéresse ?</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Le plus rapide : écrivez-nous sur WhatsApp.</p>
                  </div>
                  {property.whatsapp_url && (
                    <Button asChild size="lg" className="w-full bg-emerald-600 text-white hover:bg-emerald-700">
                      <a href={property.whatsapp_url} target="_blank" rel="noreferrer"><MessageCircle className="h-5 w-5" /> Écrire sur WhatsApp</a>
                    </Button>
                  )}
                  {company?.phone && (
                    <Button asChild variant="outline" size="lg" className="w-full">
                      <a href={`tel:${company.phone}`}><Phone className="h-5 w-5" /> {formatPhone(company.phone)}</a>
                    </Button>
                  )}
                  <div className="relative py-2 text-center text-xs uppercase tracking-wider text-muted-foreground">
                    <span className="relative z-10 bg-card px-2">ou laissez vos coordonnées</span>
                    <span className="absolute inset-x-0 top-1/2 border-t" />
                  </div>
                  <LeadForm compact property={property.slug} submitLabel="Être rappelé"
                    defaultMessage={`Bonjour, je suis intéressé(e) par « ${property.title} » (réf. ${property.reference}). Je souhaite le visiter.`} />
                </CardContent>
              </Card>
            </div>
          </div>

          {others.length > 0 && (
            <section className="mt-16">
              <h2 className="mb-6 font-display text-2xl font-semibold">Biens similaires</h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {others.map((p) => <PropertyCard key={p.slug} property={p} />)}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
