import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Building2, CalendarDays, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { initials, useSite } from "@/lib/site";
import { useAuth } from "../auth";
import { Field, FormError } from "../components/ui";

const highlights = [
  { icon: Building2, text: "Vos biens vérifiés, publiés sur le site en un clic" },
  { icon: CalendarDays, text: "Visites, rappels et demandes du site au même endroit" },
  { icon: ShieldCheck, text: "Titres fonciers et pièces d'identité protégés" },
];

export default function LoginPage() {
  const { user, login } = useAuth();
  const { data: site } = useSite();
  const name = site?.company.trade_name ?? "Borom Daradji";
  const logo = site?.company.logo_url;
  const mark = (className: string, text: string) => logo
    ? <img src={logo} alt={name} className="h-11 w-auto max-w-[8rem] rounded-xl bg-white object-contain p-1" />
    : <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${className}`}><span className={`font-display text-lg font-bold ${text}`}>{initials(name)}</span></div>;
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
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
    <div className="admin grid min-h-screen lg:grid-cols-2">
      <Helmet><title>{`Connexion | ${name}`}</title><meta name="robots" content="noindex" /></Helmet>

      <div className="relative hidden overflow-hidden bg-navy p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-gold/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-primary/40 blur-3xl" />
        <div className="relative flex items-center gap-3">
          {mark("bg-gold", "text-gold-foreground")}
          <div><p className="font-semibold">{name}</p><p className="text-sm text-primary-foreground/60">Immobilier · Travaux · Matériaux</p></div>
        </div>
        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">L'espace de travail de l'agence.</h1>
          <ul className="mt-8 space-y-4">
            {highlights.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-primary-foreground/85">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10"><Icon className="h-4 w-4" /></span>{text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-primary-foreground/50">{site?.company.city ?? "Dakar"}, Sénégal</p>
      </div>

      <div className="flex items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            {mark("bg-navy", "text-gold")}
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">Connexion</h2>
          <p className="mt-1 text-sm text-muted-foreground">Avec votre email ou votre numéro de téléphone.</p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label="Email ou téléphone" htmlFor="login" error={error?.field("login")}>
              <Input id="login" className="h-11 bg-card" autoComplete="username" placeholder="77 123 45 67" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required autoFocus />
            </Field>
            <Field label="Mot de passe" htmlFor="password" error={error?.field("password")}>
              <div className="relative">
                <Input id="password" className="h-11 bg-card pr-10" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
            {error && !error.field("login") && !error.field("password") && <FormError message={error.message} />}
            <Button type="submit" className="h-11 w-full" disabled={pending}>{pending ? "Connexion…" : "Se connecter"}</Button>
          </form>
          <p className="mt-6 text-center text-xs text-muted-foreground">Mot de passe oublié ? Le dirigeant peut le réinitialiser depuis « Comptes ».</p>
        </div>
      </div>
    </div>
  );
}
