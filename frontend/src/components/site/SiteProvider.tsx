import { createContext, useContext, useEffect, type ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { themeVariables, useSite, type PublicSite } from "@/lib/site";

const SiteContext = createContext<PublicSite | null>(null);

/** Contenu du site : disponible dans toutes les pages publiques (chargé une fois par SiteProvider). */
export function useSiteData(): PublicSite {
  const site = useContext(SiteContext);
  if (!site) throw new Error("useSiteData doit être utilisé sous <SiteProvider>.");
  return site;
}

/** Applique la charte choisie par le dirigeant : couleurs, logo en icône d'onglet, référencement. */
function SiteTheme({ site }: { site: PublicSite }) {
  const { primary_color, accent_color } = site.content.identity;
  const logo = site.company.logo_url;

  useEffect(() => {
    const root = document.documentElement;
    const vars = themeVariables(primary_color, accent_color);
    Object.entries(vars).forEach(([name, value]) => root.style.setProperty(name, value));
    return () => Object.keys(vars).forEach((name) => root.style.removeProperty(name));
  }, [primary_color, accent_color]);

  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link || !logo) return;
    const previous = link.href;
    link.href = logo;
    return () => { link.href = previous; };
  }, [logo]);

  const { title, description } = site.content.seo;
  return (
    <Helmet defaultTitle={title} titleTemplate={`%s | ${site.company.trade_name}`}>
      <meta name="description" content={description} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:site_name" content={site.company.trade_name} />
      {logo && <meta property="og:image" content={logo} />}
      <meta name="theme-color" content={primary_color} />
    </Helmet>
  );
}

export function SiteProvider({ children }: { children: ReactNode }) {
  const { data, isError, refetch, isFetching } = useSite();

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        {isError ? (
          <>
            <p className="text-lg font-semibold">Le site est momentanément indisponible.</p>
            <p className="text-muted-foreground">Vérifiez votre connexion, puis réessayez.</p>
            <Button onClick={() => refetch()} disabled={isFetching}>Réessayer</Button>
          </>
        ) : (
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Chargement" />
        )}
      </div>
    );
  }

  return (
    <SiteContext.Provider value={data}>
      <SiteTheme site={data} />
      {children}
    </SiteContext.Provider>
  );
}
