import { useQuery } from "@tanstack/react-query";
import { ImageIcon } from "lucide-react";
import { fetchBlobUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Photo privée (état des lieux, chantier) : chargée avec le jeton de connexion. */
export function ProtectedImage({ url, className, alt = "" }: { url: string; className?: string; alt?: string }) {
  const { data, isError } = useQuery({ queryKey: ["blob", url], queryFn: () => fetchBlobUrl(url), staleTime: Infinity, gcTime: 10 * 60 * 1000 });
  if (!data) {
    return <span className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}><ImageIcon className={cn("h-4 w-4", !isError && "animate-pulse")} /></span>;
  }
  return <img src={data} alt={alt} className={cn("object-cover", className)} />;
}
