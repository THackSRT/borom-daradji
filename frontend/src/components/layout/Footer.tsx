import { Link } from 'react-router-dom';
import { Phone, Mail, MapPin, Facebook, Instagram, Linkedin, Twitter } from 'lucide-react';

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
  agence: [
    { name: 'À propos', href: '/contact' },
    { name: 'Notre équipe', href: '/contact' },
    { name: 'Carrières', href: '/contact' },
    { name: 'Contact', href: '/contact' },
  ],
};

const socialLinks = [
  { name: 'Facebook', icon: Facebook, href: '#' },
  { name: 'Instagram', icon: Instagram, href: '#' },
  { name: 'LinkedIn', icon: Linkedin, href: '#' },
  { name: 'Twitter', icon: Twitter, href: '#' },
];

export function Footer() {
  return (
    <footer className="bg-navy text-primary-foreground">
      {/* Main footer */}
      <div className="container py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-accent flex items-center justify-center">
                <span className="font-display font-bold text-xl text-accent-foreground">BD</span>
              </div>
              <div>
                <p className="font-display font-bold text-lg leading-tight">Borom Daradji</p>
                <p className="text-xs text-primary-foreground/70">Agence Immobilière</p>
              </div>
            </div>
            <p className="text-primary-foreground/80 text-sm leading-relaxed">
              Votre partenaire de confiance pour tous vos projets immobiliers et travaux de construction au Sénégal.
            </p>
            <div className="flex gap-4">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  className="w-10 h-10 rounded-full bg-primary-foreground/10 flex items-center justify-center hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <social.icon className="h-5 w-5" />
                </a>
              ))}
            </div>
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
              <li>
                <a href="tel:+221771234567" className="flex items-start gap-3 text-primary-foreground/80 hover:text-accent transition-colors text-sm">
                  <Phone className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <p>+221 77 123 45 67</p>
                    <p>+221 33 867 89 00</p>
                  </div>
                </a>
              </li>
              <li>
                <a href="mailto:contact@boromdaradji.sn" className="flex items-center gap-3 text-primary-foreground/80 hover:text-accent transition-colors text-sm">
                  <Mail className="h-5 w-5 flex-shrink-0" />
                  contact@boromdaradji.sn
                </a>
              </li>
              <li className="flex items-start gap-3 text-primary-foreground/80 text-sm">
                <MapPin className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <div>
                  <p>123 Avenue Cheikh Anta Diop</p>
                  <p>Dakar, Sénégal</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-primary-foreground/10">
        <div className="container py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-primary-foreground/60">
            © {new Date().getFullYear()} Agence Immobilière Borom Daradji. Tous droits réservés.
          </p>
          <div className="flex gap-6 text-sm text-primary-foreground/60">
            <Link to="#" className="hover:text-primary-foreground transition-colors">
              Mentions légales
            </Link>
            <Link to="#" className="hover:text-primary-foreground transition-colors">
              Politique de confidentialité
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
