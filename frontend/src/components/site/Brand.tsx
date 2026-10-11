import { cn } from "@/lib/utils";
import { initials } from "@/lib/site";
import { useSiteData } from "./SiteProvider";

/** Logo de l'agence (envoyé dans le back-office) ou ses initiales, avec le nom et le slogan. */
export function Brand({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { company, content } = useSiteData();
  const dark = tone === "dark";

  return (
    <div className="flex min-w-0 items-center gap-3">
      {company.logo_url ? (
        <img src={company.logo_url} alt={company.trade_name} className="h-12 w-auto max-w-[9rem] flex-shrink-0 rounded-lg object-contain" />
      ) : (
        <div className={cn("flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg", dark ? "bg-accent" : "gradient-hero")}>
          <span className={cn("font-display text-xl font-bold", dark ? "text-accent-foreground" : "text-primary-foreground")}>
            {initials(company.trade_name)}
          </span>
        </div>
      )}
      {(content.identity.show_name || !company.logo_url) && <div className={cn("min-w-0", !dark && "hidden sm:block")}>
        <p className={cn("truncate font-display text-lg font-bold leading-tight", dark ? "" : "text-navy")}>{company.trade_name}</p>
        {content.identity.tagline && (
          <p className={cn("truncate text-xs", dark ? "text-primary-foreground/70" : "text-muted-foreground")}>{content.identity.tagline}</p>
        )}
      </div>}
    </div>
  );
}
