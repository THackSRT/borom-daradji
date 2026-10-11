import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSiteData } from '@/components/site/SiteProvider';
import { SiteIcon } from '@/components/site/SiteIcon';

export function ServicesSection() {
  const { home } = useSiteData().content;
  return (
    <section className="py-20 bg-muted/30">
      <div className="container">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          {home.services_kicker && (
            <p className="text-accent font-semibold mb-3 uppercase tracking-wider text-sm">
              {home.services_kicker}
            </p>
          )}
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
            {home.services_title}
          </h2>
          <p className="text-muted-foreground text-lg">
            {home.services_subtitle}
          </p>
        </div>

        {/* Services grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {home.services.map((service, index) => (
            <Card 
              key={`${service.title}-${index}`} 
              variant="service"
              className="animate-fade-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardContent className="p-6 space-y-4">
                <div className="w-14 h-14 rounded-xl bg-accent/10 flex items-center justify-center">
                  <SiteIcon name={service.icon} className="h-7 w-7 text-accent" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-xl text-foreground mb-2">
                    {service.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {service.description}
                  </p>
                </div>
                <ul className="space-y-2">
                  {(service.features ?? []).map((feature) => (
                    <li 
                      key={feature}
                      className="flex items-center gap-2 text-sm text-foreground"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <Link to="/travaux">
            <Button variant="navy" size="lg">
              Découvrir tous nos services
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
