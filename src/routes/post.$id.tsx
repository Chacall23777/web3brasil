import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PostCard, type FeedPost } from "@/components/PostCard";

export const Route = createFileRoute("/post/$id")({
  component: PostPage,
  head: () => ({ meta: [{ title: "Postagem — WEB3BRASIL" }] }),
});

function PostPage() {
  const { id } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["post", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select("*, profiles(display_name, avatar_url, telegram)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw notFound();
      return data as unknown as FeedPost;
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-4">
      <Link to="/comunidade" className="text-sm text-muted-foreground hover:text-foreground">← Voltar</Link>
      {isLoading && <div className="text-sm text-muted-foreground">Carregando…</div>}
      {error && <div className="text-sm text-destructive">Postagem não encontrada.</div>}
      {data && <PostCard post={data} showComments />}
    </div>
  );
}
