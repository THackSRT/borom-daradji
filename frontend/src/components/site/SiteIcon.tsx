import {
  Award, Building2, Check, Droplets, Hammer, Home, KeyRound, Package, Paintbrush, Phone, ShieldCheck, Star,
  TreeDeciduous, Truck, Users, Wind, Wrench, Zap, type LucideIcon, type LucideProps,
} from "lucide-react";

/** Icônes proposées dans le back-office (mêmes noms que SiteContent::ICONS côté serveur). */
export const siteIcons: Record<string, { icon: LucideIcon; label: string }> = {
  home: { icon: Home, label: "Maison" },
  building: { icon: Building2, label: "Immeuble" },
  hammer: { icon: Hammer, label: "Marteau" },
  package: { icon: Package, label: "Colis" },
  paintbrush: { icon: Paintbrush, label: "Pinceau" },
  wrench: { icon: Wrench, label: "Clé" },
  zap: { icon: Zap, label: "Électricité" },
  droplets: { icon: Droplets, label: "Eau" },
  wind: { icon: Wind, label: "Air" },
  tree: { icon: TreeDeciduous, label: "Arbre" },
  users: { icon: Users, label: "Clients" },
  award: { icon: Award, label: "Récompense" },
  check: { icon: Check, label: "Validé" },
  key: { icon: KeyRound, label: "Clés" },
  shield: { icon: ShieldCheck, label: "Garantie" },
  truck: { icon: Truck, label: "Livraison" },
  phone: { icon: Phone, label: "Téléphone" },
  star: { icon: Star, label: "Étoile" },
};

export function SiteIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = siteIcons[name]?.icon ?? Check;
  return <Icon {...props} />;
}
