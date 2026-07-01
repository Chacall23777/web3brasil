import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Heart, MessageCircle, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { TokenChart } from "./TokenChart";
import { ShareButtons } from "./ShareButtons";
import { TelegramIcon } from "./SocialIcons";

export type FeedPost = {
  id: string;
  user_id: string;
  type: "text" | "token";
  title: string | null;
  content: string | null;
  image_url: string | null;
  token_name: string | null;
  token_symbol: string | null;
  token_contract: string | null;
  token_chain: string | null;
  token_link: string | null;
  created_at: string;
  profiles: {
    display_name: string;
    avatar_url: string | null;
    telegram: string | null;
  } | null;
};

export function PostCard({ post, showComments = false }: { post: FeedPost; showComments?: boolean }) {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const author = post.profiles;
  const postUrl = typeof window !== "undefined"
    ? `${window.location.origin}/post/${post.id}`
    : `/post/${post.id}`;

  const { data: likeInfo } = useQuery({
    queryKey: ["post-likes", post.id, user?.id ?? "anon"],
    queryFn: async () => {
      const [{ count }, mine] = await Promise.all([
        supabase.from("likes").select("*", { count: "exact", head: true }).eq("post_id", post.id),
        user
          ? supabase.from("likes").select("id").eq("post_id", post.id).eq("user_id", user.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      return { count: count ?? 0, liked: !!mine.data };
    },
  });

  const toggleLike = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Entre para curtir");
      if (likeInfo?.liked) {
        await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", user.id);
      } else {
        await supabase.from("likes").insert({ post_id: post.id, user_id: user.id });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["post-likes", post.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePost = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("posts").delete().eq("id", post.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Postagem removida");
      qc.invalidateQueries({ queryKey: ["feed"] });
      navigate({ to: "/comunidade" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canDelete = user && (user.id === post.user_id || isAdmin);

  return (
    <article className="rounded-xl border bg-card overflow-hidden">
      <header className="p-4 flex items-center gap-3">
        {author?.avatar_url ? (
          <img src={author.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <div className="h-10 w-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
            {(author?.display_name ?? "?")[0]}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">{author?.display_name ?? "Usuário"}</div>
          <div className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}
          </div>
        </div>
        {author?.telegram && (
          <a
            href={author.telegram.startsWith("http") ? author.telegram : `https://t.me/${author.telegram.replace(/^@/, "")}`}
            target="_blank" rel="noopener noreferrer"
            className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-primary"
            aria-label="Telegram do autor"
          >
            <TelegramIcon width={16} height={16} />
          </a>
        )}
        {canDelete && (
          <button onClick={() => confirm("Apagar postagem?") && deletePost.mutate()}
            className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted" aria-label="Apagar">
            <Trash2 size={16} />
          </button>
        )}
      </header>

      <div className="px-4 pb-3 space-y-3">
        {post.type === "token" ? (
          <>
            <div className="flex items-start gap-3">
              {post.image_url && (
                <img src={post.image_url} alt="" className="h-16 w-16 rounded-lg object-cover border" />
              )}
              <div className="min-w-0">
                <h3 className="font-display text-xl font-bold leading-tight">
                  {post.token_name}
                  {post.token_symbol && <span className="ml-2 text-sm font-normal text-primary">${post.token_symbol}</span>}
                </h3>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Rede: <span className="uppercase">{post.token_chain}</span>
                  {post.token_contract && (
                    <> · <span className="font-mono break-all">{post.token_contract.slice(0, 8)}…{post.token_contract.slice(-6)}</span></>
                  )}
                </div>
                {post.token_link && (
                  <a href={post.token_link} target="_blank" rel="noopener noreferrer nofollow ugc"
                    className="inline-block mt-1 text-xs text-primary hover:underline">
                    Site do projeto ↗
                  </a>
                )}
              </div>
            </div>
            {post.content && <p className="text-sm whitespace-pre-wrap">{post.content}</p>}
            <TokenChart chain={post.token_chain} contract={post.token_contract} />
          </>
        ) : (
          <>
            {post.title && <h3 className="font-display text-lg font-semibold">{post.title}</h3>}
            {post.content && <p className="text-sm whitespace-pre-wrap">{post.content}</p>}
            {post.image_url && <img src={post.image_url} alt="" className="rounded-lg border max-h-96" />}
          </>
        )}
      </div>

      <footer className="px-3 pb-3 flex items-center gap-1 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => toggleLike.mutate()} className={likeInfo?.liked ? "text-primary" : ""}>
          <Heart size={16} className={likeInfo?.liked ? "fill-current" : ""} /> {likeInfo?.count ?? 0}
        </Button>
        <Link to="/post/$id" params={{ id: post.id }}>
          <Button variant="ghost" size="sm"><MessageCircle size={16} /> Comentar</Button>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <ShareButtons
            url={postUrl}
            text={post.type === "token" ? `${post.token_name} ($${post.token_symbol}) na WEB3BRASIL` : (post.title ?? "Post na WEB3BRASIL")}
          />
        </div>
      </footer>

      {showComments && <Comments postId={post.id} />}
    </article>
  );
}

function Comments({ postId }: { postId: string }) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const { data: comments } = useQuery({
    queryKey: ["comments", postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("id, content, created_at, user_id, profiles(display_name, avatar_url)")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Entre para comentar");
      const content = text.trim();
      if (!content) return;
      const { error } = await supabase.from("comments").insert({ post_id: postId, user_id: user.id, content });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["comments", postId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="border-t px-4 py-3 space-y-3 bg-muted/20">
      <h4 className="text-sm font-semibold">Comentários</h4>
      <div className="space-y-3">
        {(comments ?? []).map((c: any) => (
          <div key={c.id} className="flex gap-2">
            {c.profiles?.avatar_url ? (
              <img src={c.profiles.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                {(c.profiles?.display_name ?? "?")[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{c.profiles?.display_name ?? "Usuário"}</span>
                {" · "}
                {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
              </div>
              <div className="text-sm whitespace-pre-wrap">{c.content}</div>
            </div>
          </div>
        ))}
        {comments?.length === 0 && <div className="text-sm text-muted-foreground">Nenhum comentário ainda.</div>}
      </div>

      {user ? (
        <form
          onSubmit={(e) => { e.preventDefault(); add.mutate(); }}
          className="flex gap-2 items-start"
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
              {(profile?.display_name ?? "?")[0]}
            </div>
          )}
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Escreva um comentário…" rows={2} maxLength={1000} className="flex-1" />
          <Button type="submit" disabled={add.isPending || !text.trim()}>Enviar</Button>
        </form>
      ) : (
        <div className="text-sm text-muted-foreground">
          <Link to="/auth" className="text-primary hover:underline">Entre</Link> para comentar.
        </div>
      )}
    </div>
  );
}
