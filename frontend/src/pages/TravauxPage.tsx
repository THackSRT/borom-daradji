import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, Check, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { constructionServices, completedProjects } from '@/data/services';
import { LeadForm } from '@/components/public/LeadForm';
import { useCompany } from '@/lib/public';

export default function TravauxPage() {
  const [serviceType, setServiceType] = useState('');
  const serviceLabel = constructionServices.find((s) => s.id === serviceType)?.title;
  const { data: company } = useCompany();

  return (
    <>
      <Helmet>
        <title>Travaux & Rénovation | Borom Daradji - Construction au Sénégal</title>
        <meta name="description" content="Services de construction et rénovation au Sénégal : maçonnerie, plomberie, électricité, peinture, climatisation. Devis gratuit sous 24h." />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Hero */}
        <section className="bg-navy py-20">
          <div className="container">
            <div className="max-w-3xl">
              <p className="text-accent font-semibold mb-4 uppercase tracking-wider text-sm">
                Travaux & Rénovation
              </p>
              <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-primary-foreground mb-6">
                Vos projets de construction avec des professionnels qualifiés
              </h1>
              <p className="text-primary-foreground/80 text-lg mb-8">
                De la conception à la réalisation, notre équipe d'artisans expérimentés 
                transforme vos espaces avec qualité et professionnalisme.
              </p>
              <div className="flex flex-wrap gap-4">
                <a href="#devis">
                  <Button variant="gold" size="xl">
                    Demander un devis gratuit
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </a>
                <a href={company?.phone ? `tel:${company.phone}` : "/contact"}>
                  <Button variant="hero-outline" size="xl">
                    <Phone className="h-5 w-5" />
                    Nous appeler
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Services */}
        <section className="py-20">
          <div className="container">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <p className="text-accent font-semibold mb-3 uppercase tracking-wider text-sm">
                Nos Prestations
              </p>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-6">
                Tous les corps de métier pour vos travaux
              </h2>
              <p className="text-muted-foreground text-lg">
                Une équipe complète d'artisans qualifiés pour réaliser l'ensemble 
                de vos travaux de construction et rénovation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {constructionServices.map((service, index) => (
                <Card 
                  key={service.id}
                  variant="service"
                  className="animate-fade-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <CardContent className="p-6">
                    <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
                      <service.icon className="h-7 w-7 text-accent" />
                    </div>
                    <h3 className="font-display font-semibold text-lg text-foreground mb-2">
                      {service.title}
                    </h3>
                    <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
                      {service.description}
                    </p>
                    <ul className="space-y-2">
                      {service.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-accent flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Projects gallery */}
        <section id="projets" className="py-20 bg-muted/30">
          <div className="container">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <p className="text-accent font-semibold mb-3 uppercase tracking-wider text-sm">
                Nos Réalisations
              </p>
              <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-6">
                Avant / Après : découvrez nos chantiers
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {completedProjects.map((project, index) => (
                <Card 
                  key={project.id}
                  variant="elevated"
                  className="overflow-hidden animate-fade-up"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="grid grid-cols-2 gap-1">
                    <div className="relative aspect-square">
                      <img 
                        src={project.beforeImage} 
                        alt="Avant" 
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-2 left-2 bg-navy/80 text-primary-foreground text-xs px-2 py-1 rounded">
                        Avant
                      </span>
                    </div>
                    <div className="relative aspect-square">
                      <img 
                        src={project.afterImage} 
                        alt="Après" 
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-2 left-2 bg-accent/80 text-accent-foreground text-xs px-2 py-1 rounded">
                        Après
                      </span>
                    </div>
                  </div>
                  <CardContent className="p-6">
                    <h3 className="font-display font-semibold text-lg text-foreground mb-2">
                      {project.title}
                    </h3>
                    <p className="text-muted-foreground text-sm mb-3">
                      📍 {project.location} • ⏱️ {project.duration}
                    </p>
                    <p className="text-muted-foreground text-sm mb-4">
                      {project.description}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {project.services.map((service) => (
                        <span 
                          key={service}
                          className="bg-muted text-muted-foreground text-xs px-2 py-1 rounded"
                        >
                          {service}
                        </span>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Quote form */}
        <section id="devis" className="py-20">
          <div className="container">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <p className="text-accent font-semibold mb-3 uppercase tracking-wider text-sm">
                  Devis Gratuit
                </p>
                <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-6">
                  Décrivez votre projet, nous vous répondons sous 24h
                </h2>
                <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
                  Remplissez le formulaire ci-contre pour recevoir un devis personnalisé 
                  et gratuit. Notre équipe vous contactera rapidement pour discuter de 
                  votre projet et vous proposer les meilleures solutions.
                </p>

                <div className="space-y-4">
                  {[
                    'Estimation gratuite et sans engagement',
                    'Réponse sous 24 heures',
                    'Visite sur site offerte',
                    'Garantie décennale sur tous les travaux'
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center">
                        <Check className="h-4 w-4 text-accent" />
                      </div>
                      <span className="text-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Card variant="elevated">
                <CardContent className="p-8">
                  <LeadForm
                    messagePrefix={`Demande de devis travaux${serviceLabel ? ` — ${serviceLabel}` : ""}`}
                    submitLabel="Demander mon devis gratuit"
                    extraFields={
                      <Select value={serviceType} onValueChange={setServiceType}>
                        <SelectTrigger aria-label="Type de travaux">
                          <SelectValue placeholder="Type de travaux" />
                        </SelectTrigger>
                        <SelectContent>
                          {constructionServices.map((service) => (
                            <SelectItem key={service.id} value={service.id}>{service.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    }
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
