mport { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { PostCard, type FeedPost } from "./PostCard";

type FeedItem = {
  key: string;
  post: FeedPost & { likes_count?: number; comments_count?: number; reposts_count?: number };
  sortTime: number;
  repostedBy?: { user_id: string; display_name: string | null } | null;
  quoteComment?: string | null;
};

// Regra de ranqueamento do feed:
// - Nos primeiros 60 segundos, o post é "novo" e ganha um bônus fixo enorme,
//   garantindo que fique no topo (ordenado entre os novos pelo mais recente).
// - Depois de 1 minuto, o bônus de novidade some e a ordem passa a depender
//   só do engajamento (curtidas, comentários, reposts). Um empurrãozinho
//   quase invisível de recência só serve pra desempatar posts com o mesmo
//   engajamento (o mais recente fica levemente à frente).
const NEW_POST_WINDOW_MS = 60 * 1000; // 1 minuto
const NEW_POST_BOOST = 1_000_000; // bem maior que qualquer engajamento real
const PAGE_SIZE = 15;

function engagementScore(p: FeedItem["post"], sortTime: number, now: number) {
  const likes = p.likes_count ?? 0;
  const comments = p.comments_count ?? 0;
  const reposts = p.reposts_count ?? 0;
  const engagement = likes + 2 * comments + 2 * reposts;
  const ageMs = Math.max(0, now - sortTime);

  if (ageMs < NEW_POST_WINDOW_MS) {
    // Quanto mais novo, maior o bônus (para ordenar corretamente entre os recentes)
    return NEW_POST_BOOST + (NEW_POST_WINDOW_MS - ageMs);
  }

  const ageMinutes = ageMs / 60000;
  const recencyTiebreak = 1 / (1 + ageMinutes);
  return engagement + recencyTiebreak;
}

export function Feed({ type }: { type?: "text" | "token" }) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  // Recalcula o ranking periodicamente para que um post "novo" desça do topo
  // assim que completar 1 minuto, mesmo sem o usuário atualizar a página.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["feed", type ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("posts")
        .select(
          "*, profiles(display_name, avatar_url, telegram_handle, x_handle, instagram_handle, github_handle, is_verified, account_type)",
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (type) q = q.eq("type", type);
      const { data: postsData, error: postsErr } = await q;
      if (postsErr) throw postsErr;
      const posts = (postsData ?? []) as unknown as FeedItem["post"][];
      const postsById = new Map(posts.map((p) => [p.id, p]));

      const items: FeedItem[] = posts.map((p) => ({
        key: `p:${p.id}`,
        post: p,
        sortTime: new Date(p.created_at).getTime(),
      }));

      // Only pull reposts of posts we already fetched (avoids extra join)
      if (!type && posts.length > 0) {
        const { data: repostsData } = await supabase
          .from("reposts")
          .select("id, user_id, original_post_id, comment, created_at, profiles(display_name)")
          .in(
            "original_post_id",
            posts.map((p) => p.id),
          )
          .order("created_at", { ascending: false })
          .limit(100);
        for (const r of (repostsData ?? []) as any[]) {
          const original = postsById.get(r.original_post_id);
          if (!original) continue;
          items.push({
            key: `r:${r.id}`,
            post: original,
            sortTime: new Date(r.created_at).getTime(),
            repostedBy: { user_id: r.user_id, display_name: r.profiles?.display_name ?? null },
            quoteComment: r.comment ?? null,
          });
        }
      }

      return items;
    },
  });

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data]
      .sort(
        (a, b) =>
          engagementScore(b.post, b.sortTime, now) - engagementScore(a.post, a.sortTime, now),
      )
      .slice(0, 60);
  }, [data, now]);

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Carregando…</div>;
  if (error) return <div className="text-sm text-destructive p-4">Erro ao carregar o feed.</div>;
  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        Nenhuma postagem ainda. Seja o primeiro!
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {sorted.slice(0, visible).map((it) => (
        <PostCard
          key={it.key}
          post={it.post}
          repostedBy={it.repostedBy ?? null}
          quoteComment={it.quoteComment ?? null}
        />
      ))}
      {visible < sorted.length && (
        <div className="flex justify-center pt-2 pb-4">
          <Button variant="outline" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            Carregar mais
          </Button>
        </div>
      )}
    </div>
  );
}
