import { Input } from "@/components/ui/input";
import type { Period, PeriodPreset } from "../period";
import { FilterChips } from "./ui";

/** Choix de période : préréglages en pastilles, ou dates libres. */
export function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <FilterChips<PeriodPreset> value={value.preset} onChange={(preset) => onChange({ ...value, preset })} options={[
        { value: "mois", label: "Ce mois" }, { value: "mois_precedent", label: "Mois dernier" }, { value: "trimestre", label: "Trimestre" },
        { value: "annee", label: "Cette année" }, { value: "annee_precedente", label: "Année dernière" }, { value: "personnalisee", label: "Dates…" },
      ]} />
      {value.preset === "personnalisee" && (
        <div className="flex items-center gap-2 text-sm">
          <Input type="date" className="h-9 w-40" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} />
          <span className="text-muted-foreground">au</span>
          <Input type="date" className="h-9 w-40" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} />
        </div>
      )}
    </div>
  );
}
