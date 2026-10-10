import { useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSendLead } from "@/lib/public";

/**
 * Formulaire de demande du site : contact, visite d'un bien, devis de travaux.
 * Tout aboutit au même endroit : un prospect suivi et une tâche « rappeler » pour l'agent.
 */
export function LeadForm({
  property,
  defaultMessage = "",
  messagePrefix = "",
  submitLabel = "Envoyer ma demande",
  extraFields,
  compact = false,
}: {
  property?: string;
  defaultMessage?: string;
  /** Ajouté devant le message (ex. « Demande de devis — Plomberie »). */
  messagePrefix?: string;
  submitLabel?: string;
  extraFields?: ReactNode;
  compact?: boolean;
}) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", message: defaultMessage, website: "" });
  const send = useSendLead();
  const error = send.error;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send.mutate({
      name: form.name,
      phone: form.phone,
      email: form.email || undefined,
      message: messagePrefix ? `${messagePrefix}\n\n${form.message}` : form.message,
      property,
      website: form.website || undefined,
    });
  };

  if (send.isSuccess) {
    return (
      <div className="flex flex-col items-center rounded-xl bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="mb-3 h-10 w-10 text-emerald-600" />
        <p className="font-semibold text-foreground">Demande envoyée</p>
        <p className="mt-1 text-sm text-muted-foreground">Un conseiller vous rappelle au {form.phone}, généralement dans la journée.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => { send.reset(); setForm({ ...form, message: defaultMessage }); }}>
          Envoyer une autre demande
        </Button>
      </div>
    );
  }

  const fieldError = (name: string) => error?.field(name) && <p className="mt-1 text-xs text-destructive">{error.field(name)}</p>;

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className={compact ? "space-y-4" : "grid gap-4 sm:grid-cols-2"}>
        <div>
          <Input placeholder="Votre nom *" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required aria-label="Votre nom" />
          {fieldError("name")}
        </div>
        <div>
          <Input type="tel" placeholder="Téléphone / WhatsApp *" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required aria-label="Téléphone" />
          {fieldError("phone") ?? <p className="mt-1 text-xs text-muted-foreground">Depuis l'étranger, ajoutez l'indicatif (+33…).</p>}
        </div>
      </div>
      <div>
        <Input type="email" placeholder="Email (facultatif)" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} aria-label="Email" />
        {fieldError("email")}
      </div>
      {extraFields}
      <div>
        <Textarea placeholder="Votre message *" rows={compact ? 4 : 5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required aria-label="Message" />
        {fieldError("message")}
      </div>
      {/* Champ piège invisible : les robots le remplissent, pas les humains. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })}
        className="absolute left-[-9999px] h-0 w-0 opacity-0" aria-hidden="true" />
      {error && !error.field("name") && !error.field("phone") && !error.field("message") && !error.field("email") && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error.message}</p>
      )}
      <Button type="submit" variant="gold" size="lg" className="w-full" disabled={send.isPending}>
        {send.isPending ? "Envoi…" : submitLabel}
        <Send className="h-4 w-4" />
      </Button>
      <p className="text-center text-xs text-muted-foreground">Vos coordonnées servent uniquement à vous recontacter.</p>
    </form>
  );
}
