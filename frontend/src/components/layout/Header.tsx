import { Link, useLocation } from 'react-router-dom';
import { formatPhone } from '@/lib/public';
import { Brand } from '@/components/site/Brand';
import { useSiteData } from '@/components/site/SiteProvider';
import { useState } from 'react';
import { Menu, X, Phone, Mail, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Accueil', href: '/' },
  { name: 'Nos Biens', href: '/biens' },
  { name: 'Travaux & Rénovation', href: '/travaux' },
  { name: 'Contact', href: '/contact' },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { company } = useSiteData();

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      {/* Top bar */}
      <div className="bg-navy text-primary-foreground py-2 hidden md:block">
        <div className="container flex justify-between items-center text-sm">
          <div className="flex items-center gap-6">
            {company.phone && (
              <a href={`tel:${company.phone}`} className="flex items-center gap-2 hover:text-accent transition-colors">
                <Phone className="h-4 w-4" />
                {formatPhone(company.phone)}
              </a>
            )}
            {company.email && (
              <a href={`mailto:${company.email}`} className="flex items-center gap-2 hover:text-accent transition-colors">
                <Mail className="h-4 w-4" />
                {company.email}
              </a>
            )}
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span>{company.city ?? 'Dakar'}, Sénégal</span>
          </div>
        </div>
      </div>

      {/* Main navigation */}
      <nav className="bg-background/95 backdrop-blur-md border-b border-border/50 shadow-sm">
        <div className="container flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="min-w-0" aria-label="Accueil">
            <Brand />
          </Link>

          {/* Desktop navigation */}
          <div className="hidden lg:flex items-center gap-8">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-accent relative py-2",
                  location.pathname === item.href
                    ? "text-accent after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-accent"
                    : "text-foreground"
                )}
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* CTA Button */}
          <div className="hidden lg:flex items-center gap-4">
            <Link to="/admin">
              <Button variant="ghost" size="sm">
                Espace agence
              </Button>
            </Link>
            <Link to="/biens">
              <Button variant="gold">
                Voir nos biens
              </Button>
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            type="button"
            className="lg:hidden p-2 text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-background border-t border-border animate-fade-in">
            <div className="container py-4 space-y-2">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "block py-3 px-4 rounded-lg text-base font-medium transition-colors",
                    location.pathname === item.href
                      ? "bg-accent/10 text-accent"
                      : "text-foreground hover:bg-muted"
                  )}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.name}
                </Link>
              ))}
              <div className="pt-4 space-y-2">
                <Link to="/admin" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full">
                    Espace agence
                  </Button>
                </Link>
                <Link to="/biens" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="gold" className="w-full">
                    Voir nos biens
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
