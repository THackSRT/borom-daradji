import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { 
  ArrowLeft, 
  MapPin, 
  Maximize, 
  BedDouble, 
  Bath, 
  Calendar, 
  Check,
  Phone,
  Mail,
  ChevronLeft,
  ChevronRight,
  Share2,
  Heart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getPropertyBySlug, formatPrice } from '@/data/properties';
import { toast } from 'sonner';

export default function PropertyDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const property = getPropertyBySlug(slug || '');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });

  if (!property) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Bien non trouvé</h1>
          <Link to="/biens">
            <Button>Retour aux biens</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Votre demande a été envoyée ! Nous vous contacterons rapidement.');
    setFormData({ name: '', email: '', phone: '', message: '' });
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => 
      prev === property.images.length - 1 ? 0 : prev + 1
    );
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => 
      prev === 0 ? property.images.length - 1 : prev - 1
    );
  };

  return (
    <>
      <Helmet>
        <title>{property.title} | Borom Daradji</title>
        <meta name="description" content={property.description.substring(0, 160)} />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Breadcrumb */}
        <div className="bg-muted/50 py-4">
          <div className="container">
            <div className="flex items-center gap-2 text-sm">
              <Link to="/" className="text-muted-foreground hover:text-foreground">Accueil</Link>
              <span className="text-muted-foreground">/</span>
              <Link to="/biens" className="text-muted-foreground hover:text-foreground">Nos biens</Link>
              <span className="text-muted-foreground">/</span>
              <span className="text-foreground font-medium">{property.title}</span>
            </div>
          </div>
        </div>

        <div className="container py-8">
          {/* Back button */}
          <Link to="/biens" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="h-4 w-4" />
            Retour aux biens
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main content */}
            <div className="lg:col-span-2 space-y-8">
              {/* Image gallery */}
              <div className="relative rounded-2xl overflow-hidden bg-muted">
                <div className="aspect-[16/10] relative">
                  <img
                    src={property.images[currentImageIndex]}
                    alt={property.title}
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Navigation arrows */}
                  {property.images.length > 1 && (
                    <>
                      <button
                        onClick={prevImage}
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors"
                      >
                        <ChevronLeft className="h-6 w-6" />
                      </button>
                      <button
                        onClick={nextImage}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors"
                      >
                        <ChevronRight className="h-6 w-6" />
                      </button>
                    </>
                  )}

                  {/* Badges */}
                  <div className="absolute top-4 left-4 flex gap-2">
                    <Badge variant={property.transaction === 'vente' ? 'default' : 'secondary'}>
                      {property.transaction === 'vente' ? 'Vente' : 'Location'}
                    </Badge>
                    <Badge variant="gold">{property.condition}</Badge>
                  </div>

                  {/* Actions */}
                  <div className="absolute top-4 right-4 flex gap-2">
                    <button className="w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors">
                      <Heart className="h-5 w-5" />
                    </button>
                    <button className="w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors">
                      <Share2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Thumbnails */}
                {property.images.length > 1 && (
                  <div className="flex gap-2 p-4 overflow-x-auto">
                    {property.images.map((image, index) => (
                      <button
                        key={index}
                        onClick={() => setCurrentImageIndex(index)}
                        className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                          index === currentImageIndex ? 'border-accent' : 'border-transparent'
                        }`}
                      >
                        <img src={image} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Title and price */}
              <div>
                <h1 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-4">
                  {property.title}
                </h1>
                <div className="flex flex-wrap items-center gap-4">
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-5 w-5" />
                    {property.location.address}, {property.location.neighborhood}, {property.location.city}
                  </p>
                </div>
                <p className="font-display text-3xl font-bold text-accent mt-4">
                  {formatPrice(property.price, property.transaction)}
                </p>
              </div>

              {/* Key details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-muted/50 rounded-xl p-4 text-center">
                  <Maximize className="h-6 w-6 mx-auto mb-2 text-accent" />
                  <p className="text-2xl font-bold text-foreground">{property.surface}</p>
                  <p className="text-sm text-muted-foreground">m² surface</p>
                </div>
                {property.rooms > 0 && (
                  <div className="bg-muted/50 rounded-xl p-4 text-center">
                    <div className="h-6 w-6 mx-auto mb-2 text-accent flex items-center justify-center font-bold">P</div>
                    <p className="text-2xl font-bold text-foreground">{property.rooms}</p>
                    <p className="text-sm text-muted-foreground">Pièces</p>
                  </div>
                )}
                {property.bedrooms > 0 && (
                  <div className="bg-muted/50 rounded-xl p-4 text-center">
                    <BedDouble className="h-6 w-6 mx-auto mb-2 text-accent" />
                    <p className="text-2xl font-bold text-foreground">{property.bedrooms}</p>
                    <p className="text-sm text-muted-foreground">Chambres</p>
                  </div>
                )}
                {property.bathrooms > 0 && (
                  <div className="bg-muted/50 rounded-xl p-4 text-center">
                    <Bath className="h-6 w-6 mx-auto mb-2 text-accent" />
                    <p className="text-2xl font-bold text-foreground">{property.bathrooms}</p>
                    <p className="text-sm text-muted-foreground">Salle(s) de bain</p>
                  </div>
                )}
                {property.yearBuilt && (
                  <div className="bg-muted/50 rounded-xl p-4 text-center">
                    <Calendar className="h-6 w-6 mx-auto mb-2 text-accent" />
                    <p className="text-2xl font-bold text-foreground">{property.yearBuilt}</p>
                    <p className="text-sm text-muted-foreground">Année</p>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <h2 className="font-display text-xl font-semibold mb-4">Description</h2>
                <p className="text-muted-foreground leading-relaxed">
                  {property.description}
                </p>
              </div>

              {/* Features */}
              <div>
                <h2 className="font-display text-xl font-semibold mb-4">Caractéristiques</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {property.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center">
                        <Check className="h-4 w-4 text-accent" />
                      </div>
                      <span className="text-foreground">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Contact card */}
              <Card variant="elevated" className="sticky top-32">
                <CardHeader>
                  <CardTitle className="text-xl">Intéressé par ce bien ?</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                      placeholder="Votre nom"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                    <Input
                      type="email"
                      placeholder="Votre email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                    <Input
                      type="tel"
                      placeholder="Votre téléphone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                    <Textarea
                      placeholder="Je suis intéressé par ce bien..."
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      rows={4}
                    />
                    <Button type="submit" variant="gold" className="w-full">
                      Envoyer ma demande
                    </Button>
                  </form>

                  <div className="mt-6 pt-6 border-t space-y-3">
                    <a 
                      href="tel:+221771234567"
                      className="flex items-center gap-3 text-foreground hover:text-accent transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                        <Phone className="h-5 w-5 text-accent" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Appelez-nous</p>
                        <p className="font-medium">+221 77 123 45 67</p>
                      </div>
                    </a>
                    <a 
                      href="mailto:contact@boromdaradji.sn"
                      className="flex items-center gap-3 text-foreground hover:text-accent transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                        <Mail className="h-5 w-5 text-accent" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Écrivez-nous</p>
                        <p className="font-medium">contact@boromdaradji.sn</p>
                      </div>
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
