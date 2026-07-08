import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PostCard, type FeedPost } from "./PostCard";

function engagementScore(p: FeedPost & { likes_count?: number; comments_count?: number }) {
  const likes = p.likes_count ?? 0;
  const comments = p.comments_count ?? 0;
  // Engagement dominates; recency only breaks ties among posts with similar engagement.
  const engagement = likes + 2 * comments;
  const ageHours = Math.max(0, (Date.now() - new Date(p.created_at).getTime()) / 36e5);
  const recencyBoost = 1 / (1 + ageHours / 72); // small nudge, decays slowly over ~3 days
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
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as unknown as (FeedPost & { likes_count?: number; comments_count?: number })[];
      return rows
        .slice()
        .sort((a, b) => engagementScore(b) - engagementScore(a))
        .slice(0, 50);
    },
  });

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Carregando…</div>;
  if (error) return <div className="text-sm text-destructive p-4">Erro ao carregar o feed.</div>;
  if (!data || data.length === 0) {
    return <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">Nenhuma postagem ainda. Seja o primeiro!</div>;
  }
  return (
    <div className="space-y-4">
      {data.map((p) => <PostCard key={p.id} post={p} />)}
    </div>
  );
}
