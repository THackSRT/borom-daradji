import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building, ExternalLink, FileText, Globe, Hammer, Home, Mail, Palette, RotateCcw, Search, Share2, Upload, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { socialLabel, socialNetworks } from "@/components/site/SocialIcon";
import { SiteIcon } from "@/components/site/SiteIcon";
import heroBg from "@/assets/hero-bg.jpg";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { initials, luminance, siteQueryKey, type ProjectItem, type ServiceItem, type SiteContent, type SiteSection, type StatItem } from "@/lib/site";
import { useApiMutation } from "../hooks";
import type { CompanySettings } from "../types";
import { LoadingBlock, PageHeader } from "../components/ui";
import {
  CardListEditor, ColorField, EditorGroup, IconPicker, ImageField, SiteEditorProvider, StringListEditor, TextField, ToggleRow, useEditor,
} from "../components/SiteEditor";

interface SiteSettings {
  content: SiteContent;
  defaults: SiteContent;
  customized: SiteSection[];
  image_urls: Record<string, string>;
  icons: string[];
}

const tabs: { key: SiteSection; label: string; icon: typeof Home; description: string }[] = [
  { key: "identity", label: "Identité", icon: Palette, description: "Logo, slogan et couleurs du site." },
  { key: "home", label: "Accueil", icon: Home, description: "Chaque bloc de la page d'accueil, dans l'ordre de la page." },
  { key: "works", label: "Travaux", icon: Hammer, description: "La page Travaux & Rénovation : métiers, réalisations, devis." },
  { key: "contact", label: "Contact & horaires", icon: Mail, description: "La page Contact. Téléphone, email et adresse se règlent dans Paramètres." },
  { key: "social", label: "Réseaux sociaux", icon: Share2, description: "Seuls les réseaux renseignés apparaissent en pied de page." },
  { key: "footer", label: "Pied de page", icon: Building, description: "Présentation courte et mention de copyright." },
  { key: "legal", label: "Pages légales", icon: FileText, description: "Mentions légales et politique de confidentialité." },
  { key: "seo", label: "Référencement", icon: Search, description: "Ce que Google et WhatsApp affichent quand on partage le site." },
];

type Drafts = SiteContent;
type Setter<S extends SiteSection> = (patch: Partial<SiteContent[S]>) => void;

const newService = (): ServiceItem => ({ icon: "check", title: "", description: "", features: [] });
const newStat = (): StatItem => ({ icon: "star", value: "", label: "" });
const newProject = (): ProjectItem => ({ title: "", location: "", duration: "", description: "", services: [], before_image: null, after_image: "" });

export default function SitePage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["site-settings"],
    queryFn: () => api<{ data: SiteSettings }>("/settings/site").then((r) => r.data),
  });
  const [active, setActive] = useState<SiteSection>("identity");
  const [drafts, setDrafts] = useState<Drafts | null>(null);

  // Quand le serveur renvoie un nouveau contenu, seules les parties sans modification en cours
  // (et celle qu'on vient de publier) sont remplacées : rien n'est perdu dans les autres onglets.
  const previous = useRef<SiteSettings | null>(null);
  const justSaved = useRef<SiteSection | null>(null);
  useEffect(() => {
    if (!data) return;
    const prev = previous.current;
    previous.current = data;
    setDrafts((current) => {
      if (!current || !prev) return structuredClone(data.content);
      const next = { ...current } as Record<SiteSection, unknown>;
      for (const key of Object.keys(data.content) as SiteSection[]) {
        if (key === justSaved.current || JSON.stringify(current[key]) === JSON.stringify(prev.content[key])) {
          next[key] = structuredClone(data.content[key]);
        }
      }
      return next as unknown as Drafts;
    });
    justSaved.current = null;
  }, [data]);

  const dirty = useMemo(() => {
    if (!data || !drafts) return new Set<SiteSection>();
    return new Set(tabs.map((t) => t.key).filter((key) => JSON.stringify(drafts[key]) !== JSON.stringify(data.content[key])));
  }, [data, drafts]);

  // Avertit avant de quitter la page avec des modifications non enregistrées.
  useEffect(() => {
    if (!dirty.size) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty.size]);

  const onSaved = (result: { data: SiteSettings }) => {
    queryClient.setQueryData(["site-settings"], result.data);
    queryClient.invalidateQueries({ queryKey: siteQueryKey });
  };
  const save = useApiMutation(
    (section: SiteSection) => {
      justSaved.current = section;
      return api<{ data: SiteSettings }>(`/settings/site/${section}`, { method: "PUT", body: drafts![section] });
    },
    { success: "Modifications publiées sur le site.", onSuccess: onSaved },
  );
  const reset = useApiMutation(
    (section: SiteSection) => {
      justSaved.current = section;
      return api<{ data: SiteSettings }>(`/settings/site/${section}`, { method: "DELETE" });
    },
    { success: "Contenu d'origine rétabli.", onSuccess: onSaved },
  );

  if (isLoading || !data || !drafts) return <LoadingBlock rows={6} />;

  const set = <S extends SiteSection>(section: S): Setter<S> => (patch) =>
    setDrafts((prev) => (prev ? { ...prev, [section]: { ...prev[section], ...patch } } : prev));
  const tab = tabs.find((t) => t.key === active)!;
  const customized = data.customized.includes(active);

  const editors: Record<SiteSection, ReactNode> = {
    identity: <IdentityEditor value={drafts.identity} set={set("identity")} />,
    home: <HomeEditor value={drafts.home} set={set("home")} />,
    works: <WorksEditor value={drafts.works} set={set("works")} />,
    contact: <ContactEditor value={drafts.contact} set={set("contact")} />,
    social: <SocialEditor value={drafts.social} set={set("social")} />,
    footer: <FooterEditor value={drafts.footer} set={set("footer")} />,
    legal: <LegalEditor value={drafts.legal} set={set("legal")} />,
    seo: <SeoEditor value={drafts.seo} set={set("seo")} />,
  };

  return (
    <>
      <PageHeader
        title="Site internet"
        description="Tout ce que voient les visiteurs. Rien ne change sur le site avant « Publier »."
        actions={
          <Button asChild variant="outline">
            <a href="/" target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> Voir le site</a>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        {/* Onglets : liste à gauche sur ordinateur, menu déroulant sur téléphone. */}
        <div className="lg:hidden">
          <Select value={active} onValueChange={(v) => setActive(v as SiteSection)}>
            <SelectTrigger aria-label="Partie du site"><SelectValue /></SelectTrigger>
            <SelectContent>
              {tabs.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}{dirty.has(t.key) ? " •" : ""}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <nav className="hidden lg:block">
          <div className="sticky top-24">
          <ul className="space-y-1">
            {tabs.map((t) => (
              <li key={t.key}>
                <button type="button" onClick={() => setActive(t.key)}
                  className={cn("flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition",
                    active === t.key ? "bg-card font-medium text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:bg-card/60 hover:text-foreground")}>
                  <t.icon className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1">{t.label}</span>
                  {dirty.has(t.key) && <span className="h-2 w-2 rounded-full bg-amber-500" title="Modifications non publiées" />}
                  {!dirty.has(t.key) && data.customized.includes(t.key) && <span className="h-2 w-2 rounded-full bg-emerald-500" title="Personnalisé" />}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-4 px-3 text-xs leading-relaxed text-muted-foreground">
            <span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-500" /> personnalisé
            <span className="ml-3 mr-1 inline-block h-2 w-2 rounded-full bg-amber-500" /> à publier
          </p>
          </div>
        </nav>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                {tab.label}
                {customized ? <Badge variant="secondary">Personnalisé</Badge> : <Badge variant="outline">Contenu d'origine</Badge>}
              </h2>
              <p className="text-sm text-muted-foreground">{tab.description}</p>
            </div>
            {customized && (
              <Button variant="ghost" size="sm" disabled={reset.isPending}
                onClick={() => window.confirm("Remettre le contenu d'origine pour cette partie ? Vos textes seront remplacés.") && reset.mutate(active)}>
                <RotateCcw className="h-4 w-4" /> Contenu d'origine
              </Button>
            )}
          </div>

          <SiteEditorProvider error={save.variables === active ? save.error : null} imageUrls={data.image_urls}>
            {editors[active]}
          </SiteEditorProvider>
        </div>
      </div>

      {/* Barre d'enregistrement : visible dès qu'une partie a été modifiée. */}
      {dirty.has(active) && (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t bg-card/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur lg:bottom-0 lg:left-64">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 lg:px-4">
            <p className="text-sm text-muted-foreground">Modifications non publiées dans « {tab.label} ».</p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setDrafts((prev) => (prev ? { ...prev, [active]: structuredClone(data.content[active]) } : prev))}>
                <X className="h-4 w-4" /> Annuler
              </Button>
              <Button onClick={() => save.mutate(active)} disabled={save.isPending}>
                <Globe className="h-4 w-4" /> Publier
              </Button>
            </div>
          </div>
        </div>
      )}
      {dirty.has(active) && <div className="h-20" aria-hidden />}
    </>
  );
}

/* ---------- Identité ---------- */

function IdentityEditor({ value, set }: { value: SiteContent["identity"]; set: Setter<"identity"> }) {
  const { data: company } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<{ data: CompanySettings }>("/settings/company").then((r) => r.data),
  });
  const logoInvalidate = [["settings"], siteQueryKey];
  const upload = useApiMutation(
    (file: File) => {
      const body = new FormData();
      body.append("logo", file);
      return api("/settings/company/logo", { method: "POST", body });
    },
    { success: "Logo publié sur le site.", invalidate: logoInvalidate },
  );
  const remove = useApiMutation(() => api("/settings/company/logo", { method: "DELETE" }), { success: "Logo retiré.", invalidate: logoInvalidate });
  const name = company?.trade_name ?? "Borom Daradji";

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-4">
        <EditorGroup title="Logo" description="En-tête, pied de page, icône de l'onglet du navigateur et aperçu des partages. Publié dès l'envoi.">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-24 w-40 items-center justify-center rounded-lg border bg-[repeating-conic-gradient(#f1f5f9_0%_25%,#fff_0%_50%)] bg-[length:16px_16px]">
              {company?.logo_url
                ? <img src={company.logo_url} alt="Logo" className="max-h-20 max-w-36 object-contain" />
                : <span className="flex h-12 w-12 items-center justify-center rounded-lg font-display text-xl font-bold text-white" style={{ background: value.primary_color }}>{initials(name)}</span>}
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" disabled={upload.isPending}>
                  <label className="cursor-pointer">
                    <Upload className="h-4 w-4" /> {company?.logo_url ? "Remplacer le logo" : "Envoyer un logo"}
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload.mutate(f); }} />
                  </label>
                </Button>
                {company?.logo_url && (
                  <Button variant="ghost" disabled={remove.isPending} onClick={() => window.confirm("Retirer le logo ? Les initiales s'afficheront à la place.") && remove.mutate(undefined)}>
                    Retirer
                  </Button>
                )}
              </div>
              {upload.error?.field("logo") && <p className="text-xs text-destructive">{upload.error.field("logo")}</p>}
              <p className="text-xs text-muted-foreground">PNG à fond transparent conseillé, 2 Mo maximum. Sans logo, les initiales de l'agence s'affichent.</p>
            </div>
          </div>
        </EditorGroup>

        <EditorGroup title="Nom et slogan" description={undefined}>
          <p className="text-sm">
            Nom affiché : <strong>{name}</strong>{" "}
            <Link to="/admin/parametres" className="text-primary underline-offset-2 hover:underline">modifier dans Paramètres</Link>
          </p>
          <TextField label="Slogan (sous le nom)" name="tagline" value={value.tagline} max={80} onChange={(tagline) => set({ tagline })} placeholder="Agence Immobilière" />
          <ToggleRow label="Afficher le nom et le slogan à côté du logo" description="À désactiver si le logo contient déjà le nom. Sans logo, le nom reste affiché."
            checked={value.show_name} onChange={(show_name) => set({ show_name })} />
        </EditorGroup>

        <EditorGroup title="Couleurs" description="Toutes les nuances du site (fonds, boutons, dégradés) sont calculées à partir de ces deux couleurs.">
          <div className="grid gap-4 sm:grid-cols-2">
            <ColorField label="Couleur principale" name="primary_color" value={value.primary_color} onChange={(primary_color) => set({ primary_color })} hint="Fonds sombres, titres, en-tête." />
            <ColorField label="Couleur d'accent" name="accent_color" value={value.accent_color} onChange={(accent_color) => set({ accent_color })} hint="Boutons, liens, mises en avant." />
          </div>
          <div className="flex flex-wrap gap-2">
            {[["#0d2f73", "#cf7a0c", "Bleu nuit et or (origine)"], ["#14532d", "#d97706", "Vert et ambre"], ["#7f1d1d", "#ca8a04", "Bordeaux et or"], ["#1e293b", "#0ea5e9", "Ardoise et ciel"]].map(([p, a, label]) => (
              <button key={label} type="button" onClick={() => set({ primary_color: p, accent_color: a })}
                className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition hover:bg-muted">
                <span className="flex"><span className="h-4 w-4 rounded-full" style={{ background: p }} /><span className="-ml-1.5 h-4 w-4 rounded-full ring-2 ring-white" style={{ background: a }} /></span>
                {label}
              </button>
            ))}
          </div>
        </EditorGroup>
      </div>

      <div className="xl:sticky xl:top-24 xl:self-start">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Aperçu</p>
        <ThemePreview name={name} logo={company?.logo_url ?? null} identity={value} />
      </div>
    </div>
  );
}

function ThemePreview({ name, logo, identity }: { name: string; logo: string | null; identity: SiteContent["identity"] }) {
  const { primary_color: primary, accent_color: accent } = identity;
  const valid = (c: string) => /^#[0-9a-f]{6}$/i.test(c);
  const p = valid(primary) ? primary : "#0d2f73";
  const a = valid(accent) ? accent : "#cf7a0c";
  const onAccent = luminance(a) > 0.6 ? "#111827" : "#ffffff";
  const onPrimary = luminance(p) > 0.6 ? "#111827" : "#ffffff";
  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {logo ? <img src={logo} alt="" className="h-8 w-auto max-w-20 object-contain" />
            : <span className="flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold" style={{ background: p, color: onPrimary }}>{initials(name)}</span>}
          <div className="min-w-0 leading-tight">
            {(identity.show_name || !logo) && <>
              <p className="truncate font-display text-sm font-bold" style={{ color: p }}>{name}</p>
              <p className="truncate text-[10px] text-slate-500">{identity.tagline}</p>
            </>}
          </div>
        </div>
        <span className="flex-shrink-0 rounded-md px-2.5 py-1 text-[10px] font-semibold" style={{ background: a, color: onAccent }}>Voir nos biens</span>
      </div>
      <div className="relative p-4" style={{ background: `linear-gradient(135deg, ${p}ee, ${p}aa), url(${heroBg}) center/cover` }}>
        <span className="mb-2 inline-block rounded-full px-2 py-0.5 text-[9px] font-medium" style={{ background: `${a}33`, color: a }}>● Leader de l'immobilier</span>
        <p className="font-display text-lg font-bold leading-tight" style={{ color: onPrimary }}>Votre projet commence <span style={{ color: a }}>ici</span></p>
        <div className="mt-3 flex gap-2">
          <span className="rounded-md px-2.5 py-1 text-[10px] font-semibold" style={{ background: a, color: onAccent }}>Découvrir</span>
          <span className="rounded-md border px-2.5 py-1 text-[10px]" style={{ borderColor: `${onPrimary}66`, color: onPrimary }}>Nous contacter</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3">
        {["home", "hammer"].map((icon) => (
          <div key={icon} className="rounded-lg border p-2.5">
            <span className="mb-1.5 flex h-7 w-7 items-center justify-center rounded-md" style={{ background: `${a}1a`, color: a }}><SiteIcon name={icon} className="h-4 w-4" /></span>
            <div className="h-2 w-3/4 rounded bg-slate-200" /><div className="mt-1 h-2 w-1/2 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Accueil ---------- */

function ServiceFields({ item, update, prefix, featuresMax }: { item: ServiceItem; update: (p: Partial<ServiceItem>) => void; prefix: string; featuresMax: number }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Icône</p>
          <IconPicker name={`${prefix}.icon`} value={item.icon} onChange={(icon) => update({ icon })} />
        </div>
        <TextField label="Titre" name={`${prefix}.title`} value={item.title} max={60} onChange={(title) => update({ title })} />
      </div>
      <TextField label="Description" name={`${prefix}.description`} value={item.description} max={300} multiline rows={2} onChange={(description) => update({ description })} />
      <StringListEditor label="Points clés" name={`${prefix}.features`} items={item.features} max={featuresMax} onChange={(features) => update({ features })} addLabel="Ajouter un point" />
    </>
  );
}

function serviceTitle(item: ServiceItem) {
  return <span className="flex items-center gap-2"><SiteIcon name={item.icon} className="h-4 w-4 text-muted-foreground" />{item.title || <em className="font-normal text-muted-foreground">Sans titre</em>}</span>;
}

function HomeEditor({ value, set }: { value: SiteContent["home"]; set: Setter<"home"> }) {
  return (
    <div className="space-y-4">
      <EditorGroup title="Bandeau principal" description="Le haut de la page d'accueil, avec la barre de recherche.">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <TextField label="Pastille" name="hero_badge" value={value.hero_badge} max={80} onChange={(hero_badge) => set({ hero_badge })} hint="Laisser vide pour la masquer." />
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
              <TextField label="Titre" name="hero_title" value={value.hero_title} max={120} onChange={(hero_title) => set({ hero_title })} />
              <TextField label="Mot en couleur" name="hero_highlight" value={value.hero_highlight} max={40} onChange={(hero_highlight) => set({ hero_highlight })} />
            </div>
            <TextField label="Texte" name="hero_subtitle" value={value.hero_subtitle} max={400} multiline onChange={(hero_subtitle) => set({ hero_subtitle })} />
          </div>
          <ImageField label="Photo de fond" name="hero_image" value={value.hero_image} fallback={heroBg} onChange={(hero_image) => set({ hero_image })}
            hint="Photo large (1600 px ou plus) ; elle est assombrie pour que le texte reste lisible." />
        </div>
      </EditorGroup>

      <EditorGroup title="Biens en vedette" aside={<SwitchInline checked={value.show_featured} onChange={(show_featured) => set({ show_featured })} />}
        description="Les biens cochés « mis en avant » dans Biens, sinon les plus récents.">
        <Collapsed hidden={!value.show_featured}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Surtitre" name="featured_kicker" value={value.featured_kicker} max={60} onChange={(featured_kicker) => set({ featured_kicker })} />
            <TextField label="Titre" name="featured_title" value={value.featured_title} max={120} onChange={(featured_title) => set({ featured_title })} />
          </div>
        </Collapsed>
      </EditorGroup>

      <EditorGroup title="Nos services" aside={<SwitchInline checked={value.show_services} onChange={(show_services) => set({ show_services })} />}>
        <Collapsed hidden={!value.show_services}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Surtitre" name="services_kicker" value={value.services_kicker} max={60} onChange={(services_kicker) => set({ services_kicker })} />
            <TextField label="Titre" name="services_title" value={value.services_title} max={120} onChange={(services_title) => set({ services_title })} />
          </div>
          <TextField label="Texte" name="services_subtitle" value={value.services_subtitle} max={400} multiline rows={2} onChange={(services_subtitle) => set({ services_subtitle })} />
          <CardListEditor label="Services (4 conseillés)" name="services" items={value.services} max={8} create={newService} onChange={(services) => set({ services })}
            title={serviceTitle} addLabel="Ajouter un service"
            render={(item, update, prefix) => <ServiceFields item={item} update={update} prefix={prefix} featuresMax={6} />} />
        </Collapsed>
      </EditorGroup>

      <EditorGroup title="Pourquoi nous choisir" aside={<SwitchInline checked={value.show_why} onChange={(show_why) => set({ show_why })} />}>
        <Collapsed hidden={!value.show_why}>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Surtitre" name="why_kicker" value={value.why_kicker} max={60} onChange={(why_kicker) => set({ why_kicker })} />
            <TextField label="Titre" name="why_title" value={value.why_title} max={120} onChange={(why_title) => set({ why_title })} />
          </div>
          <TextField label="Texte" name="why_text" value={value.why_text} max={600} multiline onChange={(why_text) => set({ why_text })} />
          <div className="grid gap-6 lg:grid-cols-2">
            <StringListEditor label="Points forts" name="why_points" items={value.why_points} max={10} onChange={(why_points) => set({ why_points })} addLabel="Ajouter un point fort" />
            <CardListEditor label="Chiffres clés" name="stats" items={value.stats} max={6} create={newStat} onChange={(stats) => set({ stats })} addLabel="Ajouter un chiffre"
              title={(s) => <span className="flex items-center gap-2"><SiteIcon name={s.icon} className="h-4 w-4 text-muted-foreground" /><strong>{s.value || "—"}</strong> {s.label}</span>}
              render={(item, update, prefix) => (
                <>
                  <IconPicker name={`${prefix}.icon`} value={item.icon} onChange={(icon) => update({ icon })} />
                  <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
                    <TextField label="Chiffre" name={`${prefix}.value`} value={item.value} max={20} placeholder="500+" onChange={(v) => update({ value: v })} />
                    <TextField label="Libellé" name={`${prefix}.label`} value={item.label} max={60} placeholder="Biens vendus" onChange={(label) => update({ label })} />
                  </div>
                </>
              )} />
          </div>
          <p className="text-xs text-muted-foreground">Indiquez des chiffres vérifiables : ils engagent l'agence auprès des clients.</p>
        </Collapsed>
      </EditorGroup>

      <EditorGroup title="Appels à l'action" description="Les deux encadrés en bas de page." aside={<SwitchInline checked={value.show_cta} onChange={(show_cta) => set({ show_cta })} />}>
        <Collapsed hidden={!value.show_cta}>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4 rounded-lg border p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Immobilier → page Contact</p>
              <TextField label="Titre" name="cta_property_title" value={value.cta_property_title} max={120} onChange={(cta_property_title) => set({ cta_property_title })} />
              <TextField label="Texte" name="cta_property_text" value={value.cta_property_text} max={400} multiline rows={2} onChange={(cta_property_text) => set({ cta_property_text })} />
              <TextField label="Bouton" name="cta_property_button" value={value.cta_property_button} max={40} onChange={(cta_property_button) => set({ cta_property_button })} />
            </div>
            <div className="space-y-4 rounded-lg border p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Travaux → page Travaux</p>
              <TextField label="Titre" name="cta_works_title" value={value.cta_works_title} max={120} onChange={(cta_works_title) => set({ cta_works_title })} />
              <TextField label="Texte" name="cta_works_text" value={value.cta_works_text} max={400} multiline rows={2} onChange={(cta_works_text) => set({ cta_works_text })} />
              <TextField label="Bouton" name="cta_works_button" value={value.cta_works_button} max={40} onChange={(cta_works_button) => set({ cta_works_button })} />
            </div>
          </div>
        </Collapsed>
      </EditorGroup>
    </div>
  );
}

function SwitchInline({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex flex-shrink-0 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
      {checked ? "Affiché" : "Masqué"}
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

/** Bloc masqué sur le site : ses champs restent modifiables mais s'estompent. */
function Collapsed({ hidden, children }: { hidden: boolean; children: ReactNode }) {
  return (
    <div className={cn("space-y-4 transition", hidden && "opacity-50")}>
      {hidden && <p className="text-xs font-medium text-muted-foreground">Ce bloc n'apparaît pas sur le site.</p>}
      {children}
    </div>
  );
}

/* ---------- Travaux ---------- */

function WorksEditor({ value, set }: { value: SiteContent["works"]; set: Setter<"works"> }) {
  return (
    <div className="space-y-4">
      <EditorGroup title="Bandeau">
        <TextField label="Surtitre" name="kicker" value={value.kicker} max={60} onChange={(kicker) => set({ kicker })} />
        <TextField label="Titre" name="hero_title" value={value.hero_title} max={160} onChange={(hero_title) => set({ hero_title })} />
        <TextField label="Texte" name="hero_subtitle" value={value.hero_subtitle} max={400} multiline rows={2} onChange={(hero_subtitle) => set({ hero_subtitle })} />
      </EditorGroup>

      <EditorGroup title="Corps de métier" description="Ils alimentent aussi la liste « Type de travaux » du formulaire de devis.">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Titre" name="services_title" value={value.services_title} max={120} onChange={(services_title) => set({ services_title })} />
          <TextField label="Texte" name="services_subtitle" value={value.services_subtitle} max={400} onChange={(services_subtitle) => set({ services_subtitle })} />
        </div>
        <CardListEditor label="Métiers" name="services" items={value.services} max={16} create={newService} onChange={(services) => set({ services })}
          title={serviceTitle} addLabel="Ajouter un métier"
          render={(item, update, prefix) => <ServiceFields item={item} update={update} prefix={prefix} featuresMax={8} />} />
      </EditorGroup>

      <EditorGroup title="Réalisations" description="Photos avant / après des chantiers. Sans photo « avant », seule la photo du résultat s'affiche."
        aside={<SwitchInline checked={value.show_projects} onChange={(show_projects) => set({ show_projects })} />}>
        <Collapsed hidden={!value.show_projects}>
          <TextField label="Titre" name="projects_title" value={value.projects_title} max={120} onChange={(projects_title) => set({ projects_title })} />
          <CardListEditor label="Chantiers" name="projects" items={value.projects} max={12} create={newProject} onChange={(projects) => set({ projects })} addLabel="Ajouter une réalisation"
            title={(p) => <ProjectTitle project={p} />}
            render={(item, update, prefix) => (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ImageField label="Avant (facultatif)" name={`${prefix}.before_image`} value={item.before_image} aspect="aspect-[4/3]" onChange={(before_image) => update({ before_image })} />
                  <ImageField label="Après" name={`${prefix}.after_image`} value={item.after_image} aspect="aspect-[4/3]" removable={false} onChange={(after_image) => update({ after_image: after_image ?? "" })} />
                </div>
                <TextField label="Titre" name={`${prefix}.title`} value={item.title} max={120} onChange={(title) => update({ title })} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField label="Lieu" name={`${prefix}.location`} value={item.location} max={80} placeholder="Dakar, Almadies" onChange={(location) => update({ location })} />
                  <TextField label="Durée" name={`${prefix}.duration`} value={item.duration} max={40} placeholder="3 mois" onChange={(duration) => update({ duration })} />
                </div>
                <TextField label="Description" name={`${prefix}.description`} value={item.description} max={500} multiline rows={2} onChange={(description) => update({ description })} />
                <StringListEditor label="Métiers intervenus" name={`${prefix}.services`} items={item.services} max={8} onChange={(services) => update({ services })} addLabel="Ajouter" />
              </>
            )} />
        </Collapsed>
      </EditorGroup>

      <EditorGroup title="Demande de devis">
        <TextField label="Titre" name="quote_title" value={value.quote_title} max={120} onChange={(quote_title) => set({ quote_title })} />
        <TextField label="Texte" name="quote_text" value={value.quote_text} max={600} multiline onChange={(quote_text) => set({ quote_text })} />
        <StringListEditor label="Engagements" name="commitments" items={value.commitments} max={8} onChange={(commitments) => set({ commitments })} addLabel="Ajouter un engagement"
          hint="N'annoncez que ce que l'agence garantit réellement (garantie décennale, délais…)." />
      </EditorGroup>
    </div>
  );
}

function ProjectTitle({ project }: { project: ProjectItem }) {
  const { imageUrl } = useEditor();
  const url = imageUrl(project.after_image);
  return (
    <span className="flex items-center gap-2">
      {url ? <img src={url} alt="" className="h-7 w-10 rounded object-cover" /> : <span className="h-7 w-10 rounded bg-muted" />}
      {project.title || <em className="font-normal text-muted-foreground">Sans titre</em>}
      {project.location && <span className="font-normal text-muted-foreground">· {project.location}</span>}
    </span>
  );
}

/* ---------- Contact, réseaux, pied de page, pages légales, référencement ---------- */

function ContactEditor({ value, set }: { value: SiteContent["contact"]; set: Setter<"contact"> }) {
  return (
    <div className="space-y-4">
      <EditorGroup title="En-tête de la page">
        <TextField label="Titre" name="title" value={value.title} max={80} onChange={(title) => set({ title })} />
        <TextField label="Texte d'introduction" name="intro" value={value.intro} max={500} multiline rows={2} onChange={(intro) => set({ intro })} />
      </EditorGroup>
      <EditorGroup title="Horaires d'ouverture" description="Affichés sur la page Contact et en pied de page.">
        <CardListEditor label="Créneaux" name="hours" items={value.hours} max={7} create={() => ({ days: "", hours: "" })} onChange={(hours) => set({ hours })} addLabel="Ajouter un créneau"
          title={(h) => <span>{h.days || "Jours"} : <span className="font-normal">{h.hours || "horaires"}</span></span>}
          render={(item, update, prefix) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Jours" name={`${prefix}.days`} value={item.days} max={40} placeholder="Lun - Ven" onChange={(days) => update({ days })} />
              <TextField label="Horaires" name={`${prefix}.hours`} value={item.hours} max={40} placeholder="8h30 - 18h00" onChange={(hours) => update({ hours })} />
            </div>
          )} />
      </EditorGroup>
      <EditorGroup title="Formulaire">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Titre" name="form_title" value={value.form_title} max={80} onChange={(form_title) => set({ form_title })} />
          <TextField label="Texte" name="form_text" value={value.form_text} max={200} onChange={(form_text) => set({ form_text })} />
        </div>
        <StringListEditor label="Sujets proposés" name="subjects" items={value.subjects} max={12} onChange={(subjects) => set({ subjects })} addLabel="Ajouter un sujet"
          hint="Le sujet choisi est repris dans le message reçu par l'agent." />
      </EditorGroup>
    </div>
  );
}

function SocialEditor({ value, set }: { value: SiteContent["social"]; set: Setter<"social"> }) {
  return (
    <EditorGroup title="Liens des pages" description="Adresse complète, par exemple https://www.facebook.com/boromdaradji">
      <div className="grid gap-4 sm:grid-cols-2">
        {socialNetworks.map((network) => (
          <TextField key={network} label={socialLabel(network)} name={network} value={value[network]} placeholder="https://…" onChange={(v) => set({ [network]: v })} />
        ))}
      </div>
    </EditorGroup>
  );
}

function FooterEditor({ value, set }: { value: SiteContent["footer"]; set: Setter<"footer"> }) {
  return (
    <EditorGroup title="Pied de page">
      <TextField label="Présentation courte" name="about" value={value.about} max={400} multiline rows={3} onChange={(about) => set({ about })} />
      <TextField label="Copyright" name="copyright" value={value.copyright} max={150} onChange={(copyright) => set({ copyright })} hint={`Précédé de « © ${new Date().getFullYear()} » et du nom commercial.`} />
    </EditorGroup>
  );
}

function LegalEditor({ value, set }: { value: SiteContent["legal"]; set: Setter<"legal"> }) {
  return (
    <div className="space-y-4">
      <EditorGroup title="Mentions légales" description="Raison sociale, adresse, téléphone et email viennent des Paramètres.">
        <ToggleRow label="Afficher le NINEA et le RCCM" description="Recommandé pour une société ; désactivé par défaut."
          checked={value.show_identifiers} onChange={(show_identifiers) => set({ show_identifiers })} />
        <TextField label="Texte" name="notice" value={value.notice} max={10000} multiline rows={6} onChange={(notice) => set({ notice })} hint="Un paragraphe par ligne. Indiquez l'hébergeur du site." />
      </EditorGroup>
      <EditorGroup title="Politique de confidentialité" description="Ce que l'agence fait des informations envoyées par les formulaires (loi 2008-12).">
        <TextField label="Texte" name="privacy" value={value.privacy} max={10000} multiline rows={8} onChange={(privacy) => set({ privacy })} hint="Un paragraphe par ligne." />
      </EditorGroup>
    </div>
  );
}

function SeoEditor({ value, set }: { value: SiteContent["seo"]; set: Setter<"seo"> }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <EditorGroup title="Titre et description de la page d'accueil" description="Les autres pages reprennent le nom de l'agence après leur propre titre.">
        <TextField label="Titre" name="title" value={value.title} max={70} onChange={(title) => set({ title })} hint="60 caractères environ ; mettez la ville et le métier." />
        <TextField label="Description" name="description" value={value.description} max={200} multiline rows={3} onChange={(description) => set({ description })} hint="150 caractères environ : ce qui donne envie de cliquer." />
      </EditorGroup>
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">Aperçu dans Google</p>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="text-xs text-slate-600">{window.location.host}</p>
          <p className="mt-0.5 line-clamp-1 text-lg text-[#1a0dab]">{value.title || "Titre de la page"}</p>
          <p className="mt-1 line-clamp-2 text-sm text-slate-600">{value.description || "Description de la page."}</p>
        </div>
      </div>
    </div>
  );
}
