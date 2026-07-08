import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";


export const Route = createFileRoute("/mensagens")({
  component: MessagesLayout,
  head: () => ({ meta: [{ title: "Mensagens — WEB3BRASIL" }] }),
});

type ConversationRow = {
  otherId: string;
  lastContent: string;
  lastAt: string;
  fromMe: boolean;
  profile: { display_name: string; avatar_url: string | null } | null;
};

function MessagesLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);

  const { data: convos } = useQuery({
    queryKey: ["conversations", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<ConversationRow[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("direct_messages")
        .select("id, sender_id, recipient_id, content, created_at")
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const map = new Map<string, ConversationRow>();
      for (const m of data ?? []) {
        const other = m.sender_id === user.id ? m.recipient_id : m.sender_id;
        if (map.has(other)) continue;
        map.set(other, {
          otherId: other,
          lastContent: m.content,
          lastAt: m.created_at,
          fromMe: m.sender_id === user.id,
          profile: null,
        });
      }
      const ids = Array.from(map.keys());
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", ids);
        for (const p of profs ?? []) {
          const c = map.get(p.id);
          if (c) c.profile = { display_name: p.display_name, avatar_url: p.avatar_url };
        }
      }
      return Array.from(map.values());
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("dm-inbox")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        () => { void refetchAll(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const refetchAll = async () => {
    const { refetch } = await import("@tanstack/react-query");
    void refetch;
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
      <aside className="rounded-xl border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b font-display font-semibold">Conversas</div>
        <div className="divide-y max-h-[70vh] overflow-y-auto">
          {(convos ?? []).length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">Nenhuma conversa ainda. Abra o perfil de um usuário e clique em "Mensagem".</div>
          )}
          {convos?.map((c) => (
            <Link
              key={c.otherId}
              to="/mensagens/$userId"
              params={{ userId: c.otherId }}
              className="flex items-center gap-3 p-3 hover:bg-muted [&.active]:bg-muted"
              activeProps={{ className: "active" }}
            >
              {c.profile?.avatar_url ? (
                <img src={c.profile.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
                  {(c.profile?.display_name ?? "?")[0]}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{c.profile?.display_name ?? "Usuário"}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {c.fromMe ? "Você: " : ""}{c.lastContent}
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground shrink-0">
                {formatDistanceToNow(new Date(c.lastAt), { addSuffix: false, locale: ptBR })}
              </div>
            </Link>
          ))}
        </div>
      </aside>
      <section className="rounded-xl border bg-card min-h-[60vh] flex flex-col">
        <Outlet />
      </section>
    </div>
  );
}
