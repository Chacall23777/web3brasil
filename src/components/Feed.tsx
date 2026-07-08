import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PostCard, type FeedPost } from "./PostCard";

type FeedItem = {
  key: string;
  post: FeedPost & { likes_count?: number; comments_count?: number; reposts_count?: number };
  sortTime: number;
  repostedBy?: { user_id: string; display_name: string | null } | null;
  quoteComment?: string | null;
};

function engagementScore(p: FeedItem["post"], sortTime: number) {
  const likes = p.likes_count ?? 0;
  const comments = p.comments_count ?? 0;
  const reposts = p.reposts_count ?? 0;
  const engagement = likes + 2 * comments + 2 * reposts;
  const ageHours = Math.max(0, (Date.now() - sortTime) / 36e5);
  const recencyBoost = 1 / (1 + ageHours / 72);
  return engagement + recencyBoost;
}

export function Feed({ type }: { type?: "text" | "token" }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["feed", type ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("posts")
        .select("*, profiles(display_name, avatar_url, telegram_handle, x_handle, instagram_handle, is_verified, account_type)")
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
          .in("original_post_id", posts.map((p) => p.id))
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

      return items
        .sort((a, b) => engagementScore(b.post, b.sortTime) - engagementScore(a.post, a.sortTime))
        .slice(0, 60);
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Carregando…</div>;
  if (error) return <div className="text-sm text-destructive p-4">Erro ao carregar o feed.</div>;
  if (!data || data.length === 0) {
    return <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Nenhuma postagem ainda. Seja o primeiro!</div>;
  }
  return (
    <div className="space-y-4">
      {data.map((it) => (
        <PostCard
          key={it.key}
          post={it.post}
          repostedBy={it.repostedBy ?? null}
          quoteComment={it.quoteComment ?? null}
        />
      ))}
    </div>
  );
}
