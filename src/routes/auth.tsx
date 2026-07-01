import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect } from "react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Entrar — WEB3BRASIL" }] }),
});

function AuthPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/comunidade" });
  }, [user, loading, navigate]);

  const google = async () => {
    setBusy(true);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) {
      toast.error("Não deu para entrar com Google");
      setBusy(false);
      return;
    }
    if (!r.redirected) navigate({ to: "/comunidade" });
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Conta criada. Verifique seu e-mail se necessário.");
      }
    } catch (err: any) {
      toast.error(err.message ?? "Falha na autenticação");
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-10 space-y-6">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold">Entrar na WEB3BRASIL</h1>
        <p className="text-sm text-muted-foreground mt-1">Poste, comente e curta o feed da comunidade.</p>
      </div>

      <Button onClick={google} disabled={busy} className="w-full" size="lg">
        <GoogleIcon /> Continuar com Google
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="flex-1 h-px bg-border" /> ou <div className="flex-1 h-px bg-border" />
      </div>

      <form onSubmit={submitEmail} className="space-y-2">
        <Input type="email" required placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input type="password" required minLength={6} placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" disabled={busy} className="w-full" variant="outline">
          {mode === "in" ? "Entrar" : "Criar conta"}
        </Button>
        <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="w-full text-xs text-muted-foreground hover:text-foreground">
          {mode === "in" ? "Não tem conta? Criar" : "Já tem conta? Entrar"}
        </button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        <Link to="/" className="hover:underline">← Voltar</Link>
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.6a4.8 4.8 0 0 1-2.1 3.1v2.6h3.4A10.2 10.2 0 0 0 22 12.2Z"/>
      <path fill="#34A853" d="M12 22a10 10 0 0 0 6.9-2.5l-3.4-2.6a6 6 0 0 1-9-3.2H3v2.7A10 10 0 0 0 12 22Z"/>
      <path fill="#FBBC05" d="M6.5 13.7a6 6 0 0 1 0-3.8V7.2H3a10 10 0 0 0 0 9l3.5-2.5Z"/>
      <path fill="#EA4335" d="M12 6a5.4 5.4 0 0 1 3.9 1.5l2.9-2.9A10 10 0 0 0 3 7.2l3.5 2.7A6 6 0 0 1 12 6Z"/>
    </svg>
  );
}
