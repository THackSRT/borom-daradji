import { Facebook, Instagram, Linkedin, Youtube } from "lucide-react";
import type { SiteContent } from "@/lib/site";

type Network = keyof SiteContent["social"];

const labels: Record<Network, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  x: "X (Twitter)",
};

export const socialNetworks = Object.keys(labels) as Network[];
export const socialLabel = (network: Network) => labels[network];

/** Icônes des réseaux ; TikTok et X n'existent pas dans lucide, d'où le tracé maison. */
export function SocialIcon({ network, className }: { network: Network; className?: string }) {
  switch (network) {
    case "facebook": return <Facebook className={className} />;
    case "instagram": return <Instagram className={className} />;
    case "linkedin": return <Linkedin className={className} />;
    case "youtube": return <Youtube className={className} />;
    case "tiktok":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.59 2.59 0 0 1-2.59-2.59 2.59 2.59 0 0 1 3.4-2.46V9.71a5.7 5.7 0 0 0-.81-.06 5.67 5.67 0 0 0-5.67 5.67A5.67 5.67 0 0 0 9.86 21a5.67 5.67 0 0 0 5.67-5.67V9.01a7.35 7.35 0 0 0 4.29 1.37V7.3a4.28 4.28 0 0 1-3.22-1.48Z" />
        </svg>
      );
    case "x":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
          <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.19L2 3h6.33l4.37 5.77L17.75 3Zm-1.08 16.2h1.7L7.4 4.73H5.58L16.67 19.2Z" />
        </svg>
      );
  }
}
