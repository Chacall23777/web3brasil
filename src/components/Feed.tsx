import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { PostCard, type FeedPost } from "./PostCard";

type FeedItem = {
  key: string;
  post: FeedPost & { likes_count?: number; comments_count?: number; reposts_count?: number };
  sortTime: number;
  repostedBy?: { user_id: string; display_name: string | null } | null;
  quoteComment?: string | null;
};

const NEW_POST_WINDOW_MS = 60 * 1000;
const NEW_POST_BOOST = 1_000_000;
const PAGE_SIZE = 15;

function engagementScore(p: FeedItem["post"], sortTime: number, now: number) {
  const likes = p.likes_count ?? 0;
  const comments = p.comments_count ?? 0;
  const reposts = p.reposts_count ?? 0;
  const engagement = likes + 2 * comments + 2 * reposts;
  const ageMs = Math.max(0, now - sortTime);

  if (ageMs < NEW_POST_WINDOW_MS) {
    return NEW_POST_BOOST + (NEW_POST_WINDOW_MS - ageMs);
  }

  const ageMinutes = ageMs / 60000;
  const recencyTiebreak = 1 / (1 + ageMinutes);
  return engagement + recencyTiebreak;
}

const FOLLOW_BOOST = 5_000;
const AFFINITY_PER_LIKE = 300;
const AFFINITY_CAP = 1_500;

function useAffinitySignals(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["feed_affinity", userId ?? "anon"],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const [{ data: followRows }, { data: likeRows }] = await Promise.all([
        supabase.from("follows").select("following_id").eq("follower_id", userId!),
        supabase.from("likes").select("post_id, posts(user_id)").eq("user_id", userId!).limit(300),
      ]);
      const following = new Set((followRows ?? []).map((r: any) => r.following_id as string));
      const likeCountByAuthor = new Map<string, number>();
      for (const r of (likeRows ?? []) as any[]) {
        const authorId = r.posts?.user_id as string | undefined;
        if (!authorId) continue;
        likeCountByAuthor.set(authorId, (likeCountByAuthor.get(authorId) ?? 0) + 1);
      }
      return { following, likeCountByAuthor };
    },
  });
}

function affinityBoost(
  authorId: string,
  signals: { following: Set<string>; likeCountByAuthor: Map<string, number> } | undefined,
) {
  if (!signals) return 0;
  let boost = 0;
  if (signals.following.has(authorId)) boost += FOLLOW_BOOST;
  const likedBefore = signals.likeCountByAuthor.get(authorId) ?? 0;
  boost += Math.min(likedBefore * AFFINITY_PER_LIKE, AFFINITY_CAP);
  return boost;
}

export function Feed({
  type,
  sort = "hot",
}: {
  type?: "text" | "token";
  sort?: "foryou" | "hot" | "recent";
}) {
  const { user } = useAuth();
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let t: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (t) return;
      t = setInterval(() => setNow(Date.now()), 20_000);
    };
    const stop = () => {
      if (t) clearInterval(t);
      t = null;
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else {
        setNow(Date.now());
        start();
      }
    };
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const { data: affinity } = useAffinitySignals(sort === "foryou" ? user?.id : null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["feed", type ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("posts")
        .select(
          "*, profiles(display_name, avatar_url, telegram_handle, x_handle, instagram_handle, github_handle, is_verified, account_type)",
        )
        .order("created_at", { ascending: false })
        .limit(60);
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

      if (!type && posts.length > 0) {
        const { data: repostsData } = await supabase
          .from("reposts")
          .select("id, user_id, original_post_id, comment, created_at, profiles(display_name)")
          .in(
            "original_post_id",
            posts.map((p) => p.id),
          )
          .order("created_at", { ascending: false })
          .limit(60);
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
    if (sort === "recent") {
      return [...data].sort((a, b) => b.sortTime - a.sortTime).slice(0, 60);
    }
    if (sort === "foryou") {
      return [...data]
        .sort((a, b) => {
          const scoreA =
            engagementScore(a.post, a.sortTime, now) + affinityBoost(a.post.user_id, affinity);
          const scoreB =
            engagementScore(b.post, b.sortTime, now) + affinityBoost(b.post.user_id, affinity);
          return scoreB - scoreA;
        })
        .slice(0, 60);
    }
    return [...data]
      .sort(
        (a, b) =>
          engagementScore(b.post, b.sortTime, now) - engagementScore(a.post, a.sortTime, now),
      )
      .slice(0, 60);
  }, [data, now, sort, affinity]);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [sort]);

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

