import { Link } from 'react-router-dom';
import { ArrowRight, Phone, Hammer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CTASection() {
  return (
    <section className="py-20">
      <div className="container">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* CTA Immobilier */}
          <div className="relative rounded-3xl overflow-hidden bg-navy p-8 lg:p-12">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute top-0 right-0 w-64 h-64 bg-accent rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
            </div>
            <div className="relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-accent/20 flex items-center justify-center mb-6">
                <Phone className="h-8 w-8 text-accent" />
              </div>
              <h3 className="font-display text-2xl lg:text-3xl font-bold text-primary-foreground mb-4">
                Vous vendez ou cherchez un bien ?
              </h3>
              <p className="text-primary-foreground/80 mb-8 leading-relaxed">
                Bénéficiez d'une estimation gratuite et d'un accompagnement 
                personnalisé pour votre projet immobilier.
              </p>
              <Link to="/contact">
                <Button variant="gold" size="lg">
                  Estimation gratuite
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>

          {/* CTA Travaux */}
          <div className="relative rounded-3xl overflow-hidden bg-accent p-8 lg:p-12">
            <div className="absolute inset-0 opacity-20">
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-navy rounded-full blur-3xl -translate-x-1/2 translate-y-1/2" />
            </div>
            <div className="relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-navy/20 flex items-center justify-center mb-6">
                <Hammer className="h-8 w-8 text-navy" />
              </div>
              <h3 className="font-display text-2xl lg:text-3xl font-bold text-accent-foreground mb-4">
                Un projet de travaux ?
              </h3>
              <p className="text-accent-foreground/80 mb-8 leading-relaxed">
                Construction, rénovation, aménagement... Nos équipes qualifiées 
                réalisent vos travaux avec professionnalisme.
              </p>
              <Link to="/travaux">
                <Button variant="navy" size="lg">
                  Demander un devis
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
