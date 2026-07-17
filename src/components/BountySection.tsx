import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Coins, Flame, ArrowRight, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type BountyRow = {
  id: string;
  title: string;
  token_symbol: string | null;
  reward_amount: number;
  deadline: string | null;
  status: string;
  created_at: string;
};

function timeLeft(deadline: string | null): string | null {
  if (!deadline) return null;
  const ms = new Date(deadline).getTime() - Date.now();
  if (ms <= 0) return "encerrada";
  const days = Math.floor(ms / 86_400_000);
  if (days >= 1) return `${days}d restantes`;
  const hours = Math.floor(ms / 3_600_000);
  return `${Math.max(hours, 1)}h restantes`;
}

export function BountySection() {
  const { data: bounties } = useQuery({
    queryKey: ["bounties_home_open"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("bounties")
        .select("id,title,token_symbol,reward_amount,deadline,status,created_at")
        .eq("status", "open")
        .order("reward_amount", { ascending: false })
        .limit(4);
      return (data ?? []) as BountyRow[];
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  const list = bounties ?? [];

  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/30 bg-[radial-gradient(circle_at_top_left,theme(colors.primary/25%),transparent_60%)] p-6 md:p-8">
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/20 blur-3xl"
        aria-hidden
      />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
            <Flame className="h-3.5 w-3.5" />
            Bounties WEB3BRASIL
          </div>
          <h2 className="mt-3 font-display text-2xl md:text-3xl font-bold">
            Pague ou seja pago em cripto <span className="text-primary">por qualquer tarefa</span>
          </h2>
          <p className="mt-1.5 max-w-xl text-muted-foreground">
            Crie uma bounty em qualquer token da Solana, trave a recompensa on-chain e pague quem
            entregar. Sem intermediário — o cofre é seu.
          </p>
        </div>

        <Link to="/bounties" className="shrink-0">
          <Button size="lg" className="font-bold shadow-lg shadow-primary/20">
            Ver bounties
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </Link>
      </div>

      {list.length > 0 ? (
        <div className="relative mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {list.map((b) => {
            const left = timeLeft(b.deadline);
            return (
              <Link
                key={b.id}
                to="/bounties"
                className="group rounded-xl border bg-card/80 p-4 transition hover:border-primary/60 hover:bg-card"
              >
                <div className="flex items-center gap-1.5 text-primary font-display font-bold text-lg">
                  <Coins className="h-4 w-4" />
                  {b.reward_amount.toLocaleString("pt-BR")} {b.token_symbol ?? ""}
                </div>
                <div className="mt-1.5 line-clamp-2 text-sm font-medium group-hover:text-primary">
                  {b.title}
                </div>
                {left && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {left}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="relative mt-6 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhuma bounty aberta agora.{" "}
          <Link to="/bounties" className="font-semibold text-primary hover:underline">
            Seja o primeiro a criar uma
          </Link>
          .
        </div>
      )}

      {list.length > 0 && (
        <div className="relative mt-4 flex justify-end">
          <Badge variant="outline" className="text-muted-foreground">
            {list.length} bount{list.length > 1 ? "ies" : "y"} em destaque
          </Badge>
        </div>
      )}
    </section>
  );
}
