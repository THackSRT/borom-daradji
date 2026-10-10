import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { useAuth } from "../auth";
import { Field, FormError } from "../components/ui";

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [pending, setPending] = useState(false);

  const target = (location.state as { from?: string } | null)?.from ?? "/admin";

  if (user) return <Navigate to={target} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await login(identifier, password);
      navigate(target, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "Une erreur est survenue."));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center gradient-hero px-4">
      <Helmet>
        <title>Connexion | Borom Daradji</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="w-full max-w-sm rounded-xl bg-card p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-navy">
            <span className="font-display text-xl font-bold text-primary-foreground">BD</span>
          </div>
          <h1 className="font-display text-2xl font-bold">Back-office</h1>
          <p className="text-sm text-muted-foreground">Borom Daradji</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email ou téléphone" htmlFor="login" error={error?.field("login")}>
            <Input id="login" autoComplete="username" placeholder="77 123 45 67" value={identifier}
              onChange={(e) => setIdentifier(e.target.value)} required autoFocus />
          </Field>
          <Field label="Mot de passe" htmlFor="password" error={error?.field("password")}>
            <Input id="password" type="password" autoComplete="current-password" value={password}
              onChange={(e) => setPassword(e.target.value)} required />
          </Field>
          {error && !error.field("login") && !error.field("password") && <FormError message={error.message} />}
          <Button type="submit" variant="gold" className="w-full" disabled={pending}>
            {pending ? "Connexion…" : "Se connecter"}
          </Button>
        </form>
        <p className="mt-6 text-center text-xs text-muted-foreground">Mot de passe oublié ? Demandez au dirigeant de le réinitialiser.</p>
      </div>
    </div>
  );
}
