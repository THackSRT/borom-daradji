import { Helmet } from "react-helmet-async";
import { useSiteData } from "@/components/site/SiteProvider";
import { paragraphs } from "@/lib/site";
import { formatPhone } from "@/lib/public";

/** Mentions légales et politique de confidentialité : textes saisis dans le back-office. */
export default function LegalPage({ kind }: { kind: "notice" | "privacy" }) {
  const { company, content } = useSiteData();
  const title = kind === "notice" ? "Mentions légales" : "Politique de confidentialité";
  const address = [company.address, company.city].filter(Boolean).join(", ");

  const identity = kind === "notice"
    ? [
        ["Éditeur du site", company.legal_name || company.trade_name],
        ["Adresse", address],
        ["Téléphone", company.phone ? formatPhone(company.phone) : null],
        ["Email", company.email],
        ["NINEA", company.ninea],
        ["RCCM", company.rccm],
      ].filter((row): row is [string, string] => !!row[1])
    : [];

  return (
    <>
      <Helmet><title>{title}</title></Helmet>
      <section className="bg-navy py-16">
        <div className="container">
          <h1 className="font-display text-3xl font-bold text-primary-foreground md:text-4xl">{title}</h1>
        </div>
      </section>
      <section className="py-12">
        <div className="container max-w-3xl space-y-6">
          {identity.length > 0 && (
            <dl className="grid gap-x-6 gap-y-2 rounded-xl border bg-card p-6 sm:grid-cols-[10rem_1fr]">
              {identity.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
                  <dd className="break-words">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {paragraphs(content.legal[kind]).map((line, i) => (
            <p key={i} className="leading-relaxed text-foreground/90">{line}</p>
          ))}
        </div>
      </section>
    </>
  );
}
