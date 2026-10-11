/**
 * Briques partagées de la facturation : calcul des lignes (identique au serveur), pastille d'état,
 * sélecteur de client ou de bien, fenêtre d'encaissement.
 */
import { useState, type FormEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Banknote, Check, ChevronsUpDown, Download, Landmark, Smartphone, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { api, downloadFile } from "@/lib/api";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApiMutation, useOptions } from "../hooks";
import type { Invoice, InvoiceLine } from "../types";
import { Field, FormError, StatusBadge } from "./ui";

/* ---------- Calculs (mêmes arrondis que App\Services\Billing) ---------- */

export function computeLine(line: Pick<InvoiceLine, "quantity" | "unit_price" | "vat_rate">) {
  const hundredths = Math.round(Number(line.quantity || 0) * 100);
  const amount = Math.round((hundredths * Number(line.unit_price || 0)) / 100);
  const vat = Math.round((amount * Math.round(Number(line.vat_rate || 0) * 100)) / 10000);
  return { amount, vat };
}

export function computeTotals(lines: Pick<InvoiceLine, "quantity" | "unit_price" | "vat_rate">[]) {
  return lines.reduce(
    (acc, line) => {
      const { amount, vat } = computeLine(line);
      return { subtotal: acc.subtotal + amount, vat: acc.vat + vat, total: acc.total + amount + vat };
    },
    { subtotal: 0, vat: 0, total: 0 },
  );
}

export const cfa = (amount: number) => formatPrice(amount);

/** Saisie d'un montant en francs : chiffres seulement, affiché avec séparateurs. */
export function MoneyInput({ value, onChange, id, className, autoFocus }: { value: number | ""; onChange: (v: number | "") => void; id?: string; className?: string; autoFocus?: boolean }) {
  const display = value === "" ? "" : new Intl.NumberFormat("fr-FR").format(value);
  return (
    <div className="relative">
      <Input id={id} inputMode="numeric" autoFocus={autoFocus} value={display} className={cn("pr-14 text-right tabular-nums", className)}
        onChange={(e) => { const digits = e.target.value.replace(/\D/g, ""); onChange(digits === "" ? "" : Number(digits)); }} />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">FCFA</span>
    </div>
  );
}

/* ---------- État d'une facture ---------- */

export function InvoiceStateBadge({ invoice }: { invoice: Pick<Invoice, "status" | "payment_state" | "is_overdue" | "type"> }) {
  if (invoice.status.value === "brouillon") return <StatusBadge option={invoice.status} />;
  if (invoice.type.value === "avoir") return <StatusBadge option={{ value: "emise", label: "Avoir émis" }} />;
  if (invoice.is_overdue) return <StatusBadge option={{ value: "en_retard", label: invoice.payment_state?.value === "partielle" ? "En retard (partiel)" : "En retard" }} />;
  return <StatusBadge option={invoice.payment_state} />;
}

/* ---------- Sélecteur avec recherche côté serveur ---------- */

export interface PickerItem {
  id: number;
  label: string;
  hint?: string;
}

export function EntityPicker({
  value,
  onChange,
  search,
  placeholder,
  queryKey,
  allowClear = false,
}: {
  value: PickerItem | null;
  onChange: (item: PickerItem | null) => void;
  search: (term: string) => Promise<PickerItem[]>;
  placeholder: string;
  queryKey: string;
  allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const { data, isFetching } = useQuery({ queryKey: ["picker", queryKey, term], queryFn: () => search(term), enabled: open });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="h-10 w-full justify-between bg-card font-normal">
          <span className={cn("truncate", !value && "text-muted-foreground")}>{value ? value.label : placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Rechercher…" value={term} onValueChange={setTerm} />
          <CommandList>
            <CommandEmpty>{isFetching ? "Recherche…" : "Aucun résultat."}</CommandEmpty>
            <CommandGroup>
              {allowClear && value && (
                <CommandItem value="__clear" onSelect={() => { onChange(null); setOpen(false); }} className="text-muted-foreground">Aucun</CommandItem>
              )}
              {data?.map((item) => (
                <CommandItem key={item.id} value={String(item.id)} onSelect={() => { onChange(item); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value?.id === item.id ? "opacity-100" : "opacity-0")} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.hint && <span className="ml-2 text-xs text-muted-foreground">{item.hint}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/* ---------- Encaissement ---------- */

const methodIcons: Record<string, typeof Banknote> = {
  especes: Banknote,
  wave: Smartphone,
  orange_money: Smartphone,
  free_money: Smartphone,
  cheque: Landmark,
  virement: Landmark,
};

const referenceHints: Record<string, string> = {
  wave: "Identifiant de la transaction Wave (ex. T_7HX2K9QD)",
  orange_money: "Référence du SMS Orange Money (ex. MP2410.1234.A12345)",
  free_money: "Référence de la transaction",
  cheque: "Numéro du chèque et banque",
  virement: "Référence du virement",
};

/** Modes de paiement saisis à la main (la « retenue sur caution » est automatique). */
export function useManualMethods() {
  return useOptions("payment_methods").filter((m) => m.value !== "caution");
}

/** Choix du mode de paiement en gros boutons, avec le champ de référence quand il en faut une. */
export function MethodPicker({ value, onChange, error, label = "Mode de paiement" }: { value: string; onChange: (v: string) => void; error?: string | null; label?: string }) {
  const methods = useManualMethods();
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="grid grid-cols-3 gap-2">
        {methods.map((m) => {
          const Icon = methodIcons[m.value] ?? Banknote;
          return (
            <button key={m.value} type="button" onClick={() => onChange(m.value)}
              className={cn("flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition",
                value === m.value ? "border-primary bg-primary/5 text-primary ring-1 ring-primary" : "hover:bg-muted")}>
              <Icon className="h-4 w-4" />{m.label}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-1 text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

export function referenceHint(method: string): string | undefined {
  return referenceHints[method];
}

export function PaymentDialog({ invoice, open, onOpenChange }: { invoice: Invoice; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [method, setMethod] = useState("especes");
  const [amount, setAmount] = useState<number | "">(invoice.balance);
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [proof, setProof] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<{ id: number; number: string } | null>(null);

  // Remise à zéro à chaque ouverture seulement : le solde change après l'encaissement, l'écran du reçu doit rester.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) { setAmount(invoice.balance); setReference(""); setProof(null); setNote(""); setReceipt(null); setMethod("especes"); }
  }

  const mutation = useApiMutation(
    () => {
      const body = new FormData();
      body.append("method", method);
      body.append("amount", String(amount || 0));
      body.append("paid_on", paidOn);
      if (reference) body.append("reference", reference);
      if (note) body.append("note", note);
      if (proof) body.append("proof", proof);
      return api<{ data: Invoice }>(`/invoices/${invoice.id}/payments`, { method: "POST", body });
    },
    {
      success: "Encaissement enregistré.",
      invalidate: [["invoice", String(invoice.id)], ["invoices"], ["cash-session"], ["payments"], ["client"]],
      onSuccess: (result) => {
        const latest = result.data.payments?.[0];
        if (latest) setReceipt({ id: latest.id, number: latest.number });
      },
    },
  );

  const needsReference = method !== "especes";
  const submit = (e: FormEvent) => { e.preventDefault(); mutation.mutate(undefined); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Encaisser {invoice.number}</DialogTitle>
          <DialogDescription>{invoice.client.name} · reste à payer {cfa(invoice.balance)}</DialogDescription>
        </DialogHeader>

        {receipt ? (
          <div className="space-y-4 py-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-6 w-6" /></div>
            <p className="font-medium">Reçu {receipt.number} enregistré.</p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={() => downloadFile(`/payments/${receipt.id}/receipt`, `${receipt.number}.pdf`)}><Download className="h-4 w-4" /> Télécharger le reçu</Button>
              <Button onClick={() => onOpenChange(false)}>Terminer</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <FormError message={mutation.error?.field("invoice")} />
            <MethodPicker value={method} onChange={setMethod} error={mutation.error?.field("method")} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Montant" htmlFor="pay-amount" error={mutation.error?.field("amount")}>
                <MoneyInput id="pay-amount" value={amount} onChange={setAmount} autoFocus />
              </Field>
              <Field label="Date" htmlFor="pay-date" error={mutation.error?.field("paid_on")}>
                <Input id="pay-date" type="date" value={paidOn} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setPaidOn(e.target.value)} />
              </Field>
            </div>
            {amount !== invoice.balance && invoice.balance > 0 && (
              <button type="button" className="-mt-2 text-xs text-primary hover:underline" onClick={() => setAmount(invoice.balance)}>Tout le reste : {cfa(invoice.balance)}</button>
            )}
            {needsReference && (
              <Field label="Référence de la transaction" htmlFor="pay-ref" error={mutation.error?.field("reference")} hint={referenceHints[method]}>
                <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
              </Field>
            )}
            {needsReference && (
              <Field label="Capture ou justificatif (facultatif)" error={mutation.error?.field("proof")}>
                <Button asChild variant="outline" className="w-full justify-start font-normal">
                  <label className="cursor-pointer">
                    <Upload className="h-4 w-4" />
                    <span className="truncate">{proof ? proof.name : "Joindre la capture d'écran"}</span>
                    <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
                  </label>
                </Button>
              </Field>
            )}
            {method === "especes" && <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">Les espèces s'ajoutent à votre caisse du jour.</p>}
            <Field label="Note (facultatif)" htmlFor="pay-note">
              <Textarea id="pay-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
              <Button type="submit" disabled={mutation.isPending || !amount}>Encaisser {amount ? cfa(amount) : ""}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Ligne « libellé … montant » des récapitulatifs. */
export function AmountRow({ label, value, strong, tone, children }: { label: ReactNode; value: number; strong?: boolean; tone?: "red" | "green" | "muted"; children?: ReactNode }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3 py-1 text-sm", strong && "text-base font-semibold")}>
      <span className={cn(tone === "muted" && "text-muted-foreground")}>{label}{children}</span>
      <span className={cn("tabular-nums", tone === "red" && "text-red-600", tone === "green" && "text-emerald-700", tone === "muted" && "text-muted-foreground")}>{cfa(value)}</span>
    </div>
  );
}
