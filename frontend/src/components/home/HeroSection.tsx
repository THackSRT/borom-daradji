import { Link } from 'react-router-dom';
import { ArrowRight, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchBar } from '@/components/home/SearchBar';
import heroBg from '@/assets/hero-bg.jpg';

export function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center">
      {/* Background */}
      <div className="absolute inset-0">
        <img
          src={heroBg}
          alt="Luxury real estate in Dakar"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-navy/90 via-navy/70 to-navy/50" />
      </div>

      {/* Content */}
      <div className="container relative z-10 py-20">
        <div className="max-w-3xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-accent/20 backdrop-blur-sm text-accent px-4 py-2 rounded-full mb-8 animate-fade-up">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-sm font-medium">Leader de l'immobilier au Sénégal</span>
          </div>

          {/* Heading */}
          <h1 className="font-display text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold text-primary-foreground mb-6 leading-tight animate-fade-up" style={{ animationDelay: '100ms' }}>
            Votre projet immobilier commence{' '}
            <span className="text-accent">ici</span>
          </h1>

          {/* Description */}
          <p className="text-primary-foreground/80 text-lg md:text-xl mb-10 leading-relaxed max-w-2xl animate-fade-up" style={{ animationDelay: '200ms' }}>
            Achat, vente, location ou travaux de rénovation : l'Agence Immobilière 
            Borom Daradji vous accompagne dans tous vos projets avec expertise et passion.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap gap-4 mb-16 animate-fade-up" style={{ animationDelay: '300ms' }}>
            <Link to="/biens">
              <Button variant="hero">
                Découvrir nos biens
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <a href="tel:+221771234567">
              <Button variant="hero-outline">
                <Phone className="h-5 w-5" />
                Nous contacter
              </Button>
            </a>
          </div>
        </div>

        {/* Search bar */}
        <div className="animate-fade-up" style={{ animationDelay: '400ms' }}>
          <SearchBar />
        </div>
      </div>
    </section>
  );
}
