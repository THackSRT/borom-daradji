import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LeadForm } from "@/components/public/LeadForm";
import { formatPhone, useCompany, whatsappLink } from "@/lib/public";

const subjects = [
  { value: "achat", label: "Projet d'achat" },
  { value: "location", label: "Recherche de location" },
  { value: "vente", label: "Vendre ou mettre en location mon bien" },
  { value: "gestion", label: "Gestion locative de mon bien" },
  { value: "travaux", label: "Travaux / rénovation" },
  { value: "materiaux", label: "Matériaux de construction" },
  { value: "autre", label: "Autre demande" },
];

export default function ContactPage() {
  const { data: company } = useCompany();
  const [subject, setSubject] = useState("");
  const subjectLabel = subjects.find((s) => s.value === subject)?.label;
  const address = [company?.address, company?.city].filter(Boolean).join(", ");
  const whatsapp = whatsappLink(company?.whatsapp ?? company?.phone, "Bonjour, je vous contacte depuis votre site.");

  const info = [
    company?.phone && { icon: Phone, title: "Téléphone", lines: [formatPhone(company.phone)], href: `tel:${company.phone}` },
    whatsapp && { icon: MessageCircle, title: "WhatsApp", lines: [formatPhone(company?.whatsapp ?? company?.phone)], href: whatsapp, external: true },
    company?.email && { icon: Mail, title: "Email", lines: [company.email], href: `mailto:${company.email}` },
    address && { icon: MapPin, title: "Adresse", lines: [address], href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, external: true },
    { icon: Clock, title: "Horaires", lines: ["Lun - Ven : 8h30 - 18h00", "Sam : 9h00 - 13h00"] },
  ].filter(Boolean) as { icon: typeof Phone; title: string; lines: string[]; href?: string; external?: boolean }[];

  return (
    <>
      <Helmet>
        <title>Contactez-nous | Borom Daradji - Agence immobilière à Dakar</title>
        <meta name="description" content="Contactez l'agence Borom Daradji à Dakar pour vos projets immobiliers, de travaux ou de matériaux. Réponse rapide, par téléphone ou WhatsApp." />
      </Helmet>

      <div className="min-h-screen bg-background">
        <section className="bg-navy py-20">
          <div className="container">
            <div className="max-w-3xl">
              <h1 className="mb-6 font-display text-3xl font-bold text-primary-foreground md:text-4xl lg:text-5xl">Contactez-nous</h1>
              <p className="text-lg text-primary-foreground/80">
                Une question, un projet ? Laissez-nous un message : un conseiller vous rappelle, au Sénégal comme à l'étranger.
              </p>
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="container">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              <div className="space-y-4">
                {info.map((item) => {
                  const content = (
                    <Card variant="service">
                      <CardContent className="p-0">
                        <div className="flex gap-4">
                          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-accent/10">
                            <item.icon className="h-6 w-6 text-accent" />
                          </div>
                          <div>
                            <h3 className="mb-1 font-semibold text-foreground">{item.title}</h3>
                            {item.lines.map((line) => <p key={line} className="text-muted-foreground">{line}</p>)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                  return item.href ? (
                    <a key={item.title} href={item.href} target={item.external ? "_blank" : undefined} rel={item.external ? "noreferrer" : undefined} className="block">{content}</a>
                  ) : <div key={item.title}>{content}</div>;
                })}
              </div>

              <div className="lg:col-span-2">
                <Card variant="elevated">
                  <CardContent className="p-8">
                    <h2 className="mb-2 font-display text-2xl font-bold text-foreground">Envoyez-nous un message</h2>
                    <p className="mb-6 text-sm text-muted-foreground">Nous vous répondons généralement dans la journée.</p>
                    <LeadForm
                      messagePrefix={subjectLabel ? `Sujet : ${subjectLabel}` : ""}
                      extraFields={
                        <Select value={subject} onValueChange={setSubject}>
                          <SelectTrigger aria-label="Sujet"><SelectValue placeholder="Sujet de votre demande" /></SelectTrigger>
                          <SelectContent>{subjects.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                        </Select>
                      }
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
