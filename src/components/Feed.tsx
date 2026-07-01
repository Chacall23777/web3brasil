import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PostCard, type FeedPost } from "./PostCard";

export function Feed({ type }: { type?: "text" | "token" }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["feed", type ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("posts")
        .select("*, profiles(display_name, avatar_url, telegram)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (type) q = q.eq("type", type);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as FeedPost[];
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
