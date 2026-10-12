import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useApiMutation } from "../hooks";
import { Field } from "./ui";

export function PasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [form, setForm] = useState({ current_password: "", password: "", password_confirmation: "" });

  const mutation = useApiMutation((body: typeof form) => api("/auth/password", { method: "PUT", body }), {
    success: "Mot de passe modifié. Vos autres appareils ont été déconnectés.",
    onSuccess: () => {
      setForm({ current_password: "", password: "", password_confirmation: "" });
      onOpenChange(false);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  const error = mutation.error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Changer de mot de passe</DialogTitle>
          <DialogDescription>10 caractères minimum, avec des lettres et des chiffres.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Mot de passe actuel" htmlFor="current_password" error={error?.field("current_password")}>
            <Input id="current_password" type="password" autoComplete="current-password" value={form.current_password}
              onChange={(e) => setForm({ ...form, current_password: e.target.value })} required />
          </Field>
          <Field label="Nouveau mot de passe" htmlFor="password" error={error?.field("password")}>
            <Input id="password" type="password" autoComplete="new-password" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          </Field>
          <Field label="Confirmation" htmlFor="password_confirmation">
            <Input id="password_confirmation" type="password" autoComplete="new-password" value={form.password_confirmation}
              onChange={(e) => setForm({ ...form, password_confirmation: e.target.value })} required />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>Enregistrer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
