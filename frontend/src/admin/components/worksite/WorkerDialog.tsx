import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useApiMutation } from "../../hooks";
import type { Trade, Worker } from "../../types";
import { MoneyInput } from "../billing";
import { Field } from "../ui";

/** Création ou modification d'un tâcheron. */
export function WorkerDialog({ worker, onClose, onSaved }: { worker?: Worker; onClose: () => void; onSaved?: (w: Worker) => void }) {
  const { data: trades = [] } = useQuery({ queryKey: ["trades"], queryFn: () => api<{ data: Trade[] }>("/trades").then((r) => r.data) });
  const [form, setForm] = useState({
    name: worker?.name ?? "",
    phone: worker?.phone ?? "",
    trade_id: worker?.trade?.id ? String(worker.trade.id) : "",
    pay_type: worker?.pay_type.value ?? "journalier",
    daily_rate: (worker?.daily_rate ?? "") as number | "",
    is_active: worker?.is_active ?? true,
    notes: worker?.notes ?? "",
  });
  const mutation = useApiMutation(() => api<{ data: Worker }>(worker ? `/workers/${worker.id}` : "/workers", {
    method: worker ? "PUT" : "POST",
    body: { ...form, phone: form.phone || null, trade_id: form.trade_id ? Number(form.trade_id) : null, daily_rate: form.daily_rate || 0, notes: form.notes || null },
  }), {
    success: worker ? "Tâcheron mis à jour." : "Tâcheron enregistré.",
    invalidate: [["workers"], ...(worker ? [["worker", String(worker.id)]] : [])],
    onSuccess: (r) => { onSaved?.(r.data); onClose(); },
  });
  const err = (f: string) => mutation.error?.field(f);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{worker ? `Modifier ${worker.name}` : "Nouveau tâcheron"}</DialogTitle>
          <DialogDescription>Artisan ou ouvrier sans compte dans le logiciel : on le pointe et on le paie depuis les chantiers.</DialogDescription>
        </DialogHeader>
        <Field label="Nom" error={err("name")}><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Téléphone" error={err("phone")}><Input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="77 123 45 67" /></Field>
          <Field label="Métier" error={err("trade_id")}>
            <Select value={form.trade_id || "none"} onValueChange={(v) => setForm({ ...form, trade_id: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {trades.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {([["journalier", "À la journée"], ["tache", "À la tâche"]] as const).map(([v, l]) => (
            <button key={v} type="button" onClick={() => setForm({ ...form, pay_type: v })}
              className={cn("rounded-lg border px-3 py-2 text-sm font-medium", form.pay_type === v ? "border-primary bg-primary/5 text-primary ring-1 ring-primary" : "hover:bg-muted")}>{l}</button>
          ))}
        </div>
        <Field label="Tarif journalier" error={err("daily_rate")} hint={form.pay_type === "tache" ? "Facultatif : utilisé s'il est pointé à la journée." : "Appliqué au pointage ; un changement ne touche pas les journées déjà pointées."}>
          <MoneyInput value={form.daily_rate} onChange={(daily_rate) => setForm({ ...form, daily_rate })} />
        </Field>
        <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        {worker && <label className="flex items-center justify-between text-sm">Actif (proposé au pointage)<Switch checked={form.is_active} onCheckedChange={(is_active) => setForm({ ...form, is_active })} /></label>}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          <Button onClick={() => mutation.mutate(undefined)} disabled={!form.name.trim() || mutation.isPending}>Enregistrer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
