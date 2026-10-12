import { Link } from 'react-router-dom';
import { formatPhone } from '@/lib/public';
import { Phone, Mail, MapPin, Clock } from 'lucide-react';
import { Brand } from '@/components/site/Brand';
import { useSiteData } from '@/components/site/SiteProvider';
import { SocialIcon, socialLabel, socialNetworks } from '@/components/site/SocialIcon';

const navigation = {
  immobilier: [
    { name: 'Acheter', href: '/biens?transaction=vente' },
    { name: 'Louer', href: '/biens?transaction=location' },
    { name: 'Vendre votre bien', href: '/contact' },
    { name: 'Estimation gratuite', href: '/contact' },
  ],
  travaux: [
    { name: 'Rénovation', href: '/travaux' },
    { name: 'Construction', href: '/travaux' },
    { name: 'Devis gratuit', href: '/travaux#devis' },
    { name: 'Nos réalisations', href: '/travaux#projets' },
  ],
};

export function Footer() {
  const { company, content } = useSiteData();
  const socials = socialNetworks.filter((network) => content.social[network]);
  return (
    <footer className="bg-navy text-primary-foreground">
      {/* Main footer */}
      <div className="container py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="space-y-6">
            <Brand tone="dark" />
            {content.footer.about && (
              <p className="text-primary-foreground/80 text-sm leading-relaxed">{content.footer.about}</p>
            )}
            {socials.length > 0 && (
              <div className="flex flex-wrap gap-3">
                {socials.map((network) => (
                  <a
                    key={network}
                    href={content.social[network]}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={socialLabel(network)}
                    title={socialLabel(network)}
                    className="w-10 h-10 rounded-full bg-primary-foreground/10 flex items-center justify-center hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <SocialIcon network={network} className="h-5 w-5" />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Immobilier */}
          <div>
            <h4 className="font-display font-semibold text-lg mb-6">Immobilier</h4>
            <ul className="space-y-3">
              {navigation.immobilier.map((item) => (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className="text-primary-foreground/80 hover:text-accent transition-colors text-sm"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Travaux */}
          <div>
            <h4 className="font-display font-semibold text-lg mb-6">Travaux</h4>
            <ul className="space-y-3">
              {navigation.travaux.map((item) => (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className="text-primary-foreground/80 hover:text-accent transition-colors text-sm"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display font-semibold text-lg mb-6">Contact</h4>
            <ul className="space-y-4">
              {company.phone && (
                <li>
                  <a href={`tel:${company.phone}`} className="flex items-center gap-3 text-primary-foreground/80 hover:text-accent transition-colors text-sm">
                    <Phone className="h-5 w-5 flex-shrink-0" />
                    {formatPhone(company.phone)}
                  </a>
                </li>
              )}
              {company.email && (
                <li>
                  <a href={`mailto:${company.email}`} className="flex items-center gap-3 text-primary-foreground/80 hover:text-accent transition-colors text-sm">
                    <Mail className="h-5 w-5 flex-shrink-0" />
                    {company.email}
                  </a>
                </li>
              )}
              <li className="flex items-start gap-3 text-primary-foreground/80 text-sm">
                <MapPin className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div>
                  {company.address && <p>{company.address}</p>}
                  <p>{company.city ?? 'Dakar'}, Sénégal</p>
                </div>
              </li>
              {content.contact.hours.length > 0 && (
                <li className="flex items-start gap-3 text-primary-foreground/80 text-sm">
                  <Clock className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div>
                    {content.contact.hours.map((slot) => <p key={slot.days}>{slot.days} : {slot.hours}</p>)}
                  </div>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-primary-foreground/10">
        <div className="container py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-primary-foreground/60">
            © {new Date().getFullYear()} {company.trade_name}. {content.footer.copyright}
          </p>
          <div className="flex gap-6 text-sm text-primary-foreground/60">
            <Link to="/mentions-legales" className="hover:text-primary-foreground transition-colors">
              Mentions légales
            </Link>
            <Link to="/confidentialite" className="hover:text-primary-foreground transition-colors">
              Politique de confidentialité
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
