import { Check, Phone } from 'lucide-react';
import { formatPhone } from '@/lib/public';
import { useSiteData } from '@/components/site/SiteProvider';
import { SiteIcon } from '@/components/site/SiteIcon';

export function WhyChooseUs() {
  const { company, content: { home } } = useSiteData();
  return (
    <section className="py-20 gradient-hero text-primary-foreground overflow-hidden relative">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-96 h-96 bg-accent rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
      </div>

      <div className="container relative">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Content */}
          <div>
            {home.why_kicker && (
              <p className="text-accent font-semibold mb-3 uppercase tracking-wider text-sm">
                {home.why_kicker}
              </p>
            )}
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-6">
              {home.why_title}
            </h2>
            <p className="text-primary-foreground/80 text-lg mb-8 leading-relaxed">
              {home.why_text}
            </p>

            {/* Features grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {home.why_points.map((feature) => (
                <div key={feature} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                    <Check className="h-4 w-4 text-accent-foreground" />
                  </div>
                  <span className="text-primary-foreground/90">{feature}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <a 
              href={company.phone ? `tel:${company.phone}` : '/contact'}
              className="inline-flex items-center gap-3 bg-accent hover:bg-accent/90 text-accent-foreground px-8 py-4 rounded-lg font-semibold transition-all shadow-gold"
            >
              <Phone className="h-5 w-5" />
              {company.phone ? `Appelez-nous : ${formatPhone(company.phone)}` : 'Contactez-nous'}
            </a>
          </div>

          {/* Stats */}
          {home.stats.length > 0 && <div className="grid grid-cols-2 gap-6">
            {home.stats.map((stat, index) => (
              <div 
                key={index}
                className="bg-primary-foreground/10 backdrop-blur-sm rounded-2xl p-8 text-center animate-fade-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-14 h-14 rounded-xl bg-accent/20 flex items-center justify-center mx-auto mb-4">
                  <SiteIcon name={stat.icon} className="h-7 w-7 text-accent" />
                </div>
                <p className="font-display text-4xl font-bold text-accent mb-2">
                  {stat.value}
                </p>
                <p className="text-primary-foreground/70 text-sm">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>}
        </div>
      </div>
    </section>
  );
}
