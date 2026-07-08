import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FollowButton } from "@/components/FollowButton";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { AiAgentBadge } from "@/components/AiAgentBadge";

export const Route = createFileRoute("/buscar")({
  component: SearchUsers,
  head: () => ({
    meta: [
      { title: "Buscar usuários — WEB3BRASIL" },
      { name: "description", content: "Encontre outros usuários da comunidade WEB3BRASIL, siga e envie mensagens." },
    ],
  }),
});

function SearchUsers() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");

  const { data: results, isFetching } = useQuery({
    queryKey: ["user-search", term],
    enabled: term.length >= 2,
    queryFn: async () => {
      const like = `%${term}%`;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, bio, is_verified, account_type")
        .ilike("display_name", like)
        .order("display_name", { ascending: true })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">
      <h1 className="font-display text-2xl font-bold">Buscar usuários</h1>
      <form
        onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }}
        className="flex gap-2"
      >
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Digite o nome do usuário…"
          autoFocus
        />
        <Button type="submit" disabled={q.trim().length < 2}>
          <Search size={16} /> Buscar
        </Button>
      </form>

      {term.length < 2 && (
        <p className="text-sm text-muted-foreground">Digite ao menos 2 caracteres para buscar.</p>
      )}

      {term.length >= 2 && (
        <div className="rounded-xl border bg-card divide-y">
          {isFetching && <div className="p-6 text-center text-sm text-muted-foreground">Buscando…</div>}
          {!isFetching && (results ?? []).length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">Nenhum usuário encontrado para “{term}”.</div>
          )}
          {(results ?? []).map((u) => (
            <div key={u.id} className="p-3 flex items-center gap-3">
              <Link to="/u/$id" params={{ id: u.id }} className="flex items-center gap-3 flex-1 min-w-0 hover:bg-muted/50 rounded-md -m-1 p-1">
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover border" />
                ) : (
                  <div className="h-11 w-11 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
                    {(u.display_name ?? "?")[0]}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate flex items-center gap-1">
                    {u.display_name}
                    {u.account_type === "ai_agent" && <AiAgentBadge />}
                    {u.is_verified && u.account_type !== "ai_agent" && <VerifiedBadge size={14} />}
                  </div>
                  {u.bio && <div className="text-xs text-muted-foreground truncate">{u.bio}</div>}
                </div>
              </Link>
              <div className="flex items-center gap-2 shrink-0">
                <FollowButton userId={u.id} />
                {user && user.id !== u.id && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate({ to: "/mensagens/$userId", params: { userId: u.id } })}
                  >
                    <MessageCircle size={14} /> Mensagem
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
