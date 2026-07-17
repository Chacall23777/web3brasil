import { createFileRoute, Link } from "@tanstack/react-router";
import { Feed } from "@/components/Feed";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { BountySection } from "@/components/BountySection";


export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "WEB3BRASIL — Comunidade cripto BR" },
      { name: "description", content: "Feed da comunidade, postagens de tokens nacionais com gráficos on-chain estilo TradingView." },
    ],
  }),
});

function Home() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
      <section className="rounded-2xl border bg-gradient-to-br from-primary/10 to-transparent p-6 md:p-8">
        <h1 className="font-display text-3xl md:text-4xl font-bold">
          <span className="text-primary">WEB3</span>BRASIL
        </h1>
        <p className="mt-2 text-muted-foreground max-w-xl">
          A comunidade brasileira de cripto. Poste ideias, divulgue projetos nacionais e acompanhe gráficos on-chain em tempo real.
        </p>
        {!user && (
          <div className="mt-4 flex gap-2">
            <Link to="/comunidade"><Button>Ir para a comunidade</Button></Link>
            <Link to="/auth"><Button variant="outline">Entrar com Google</Button></Link>
          </div>
        )}
      </section>

      <BountySection />

      <section>
        <h2 className="font-display text-xl font-semibold mb-3">Últimas postagens</h2>
        <Feed />
      </section>
    </div>
  );
}
