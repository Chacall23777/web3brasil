import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, UserPlus, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { AiAgentBadge } from "@/components/AiAgentBadge";
import { PostCard, type FeedPost } from "@/components/PostCard";
import { UserSocialTags } from "@/components/UserSocialTags";
import { toast } from "sonner";

export const Route = createFileRoute("/u/$id")({
  component: PublicProfile,
  head: () => ({ meta: [{ title: "Perfil — WEB3BRASIL" }] }),
});

function PublicProfile() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const isMe = user?.id === id;

  const { data: profile, isLoading } = useQuery({
    queryKey: ["public-profile", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, display_name, avatar_url, bio, is_verified, account_type, telegram_handle, x_handle, instagram_handle, github_handle",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: counts } = useQuery({
    queryKey: ["follow-counts", id],
    queryFn: async () => {
      const [{ count: followers }, { count: following }] = await Promise.all([
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", id),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", id),
      ]);
      return { followers: followers ?? 0, following: following ?? 0 };
    },
  });

  const { data: iFollow } = useQuery({
    queryKey: ["i-follow", id, user?.id ?? "anon"],
    queryFn: async () => {
      if (!user || isMe) return false;
      const { data } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", user.id)
        .eq("following_id", id)
        .maybeSingle();
      return !!data;
    },
  });

  const toggleFollow = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Entre para seguir");
      if (iFollow) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("follows")
          .insert({ follower_id: user.id, following_id: id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["i-follow", id] });
      qc.invalidateQueries({ queryKey: ["follow-counts", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Traz tanto as postagens originais do usuário quanto os posts que ele
  // repostou (compartilhou), para aparecerem juntos no perfil — igual ao feed.
  const { data: activity } = useQuery({
    queryKey: ["user-activity", id],
    queryFn: async () => {
      const profilesSelect =
        "display_name, avatar_url, telegram_handle, x_handle, instagram_handle, github_handle, is_verified, account_type";

      const [{ data: ownPosts }, { data: repostRows }] = await Promise.all([
        supabase
          .from("posts")
          .select(`*, profiles(${profilesSelect})`)
          .eq("user_id", id)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("reposts")
          .select("id, comment, created_at, original_post_id, profiles(display_name)")
          .eq("user_id", id)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);

      type Item = {
        key: string;
        post: FeedPost;
        sortTime: number;
        repostedBy?: { user_id: string; display_name: string | null } | null;
        quoteComment?: string | null;
      };

      const items: Item[] = ((ownPosts ?? []) as unknown as FeedPost[]).map((p) => ({
        key: `p:${p.id}`,
        post: p,
        sortTime: new Date(p.created_at).getTime(),
      }));

      const repostRowsList = (repostRows ?? []) as any[];
      if (repostRowsList.length > 0) {
        const originalIds = repostRowsList.map((r) => r.original_post_id);
        const { data: originalPosts } = await supabase
          .from("posts")
          .select(`*, profiles(${profilesSelect})`)
          .in("id", originalIds);
        const byId = new Map(
          ((originalPosts ?? []) as unknown as FeedPost[]).map((p) => [p.id, p]),
        );
        for (const r of repostRowsList) {
          const original = byId.get(r.original_post_id);
          if (!original) continue;
          items.push({
            key: `r:${r.id}`,
            post: original,
            sortTime: new Date(r.created_at).getTime(),
            repostedBy: { user_id: id, display_name: r.profiles?.display_name ?? null },
            quoteComment: r.comment ?? null,
          });
        }
      }

      return items.sort((a, b) => b.sortTime - a.sortTime).slice(0, 30);
    },
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  if (!profile)
    return <div className="p-6 text-sm text-muted-foreground">Perfil não encontrado.</div>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-4">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              className="h-20 w-20 rounded-full object-cover border"
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-primary/20 text-primary flex items-center justify-center text-2xl font-bold">
              {(profile.display_name ?? "?")[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-xl font-bold flex items-center gap-1 flex-wrap">
              <span className="truncate">{profile.display_name}</span>
              {profile.account_type === "ai_agent" && <AiAgentBadge />}
              {profile.is_verified && profile.account_type !== "ai_agent" && (
                <VerifiedBadge size={18} />
              )}
            </h1>
            {profile.bio && (
              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
                {profile.bio}
              </p>
            )}
            <div className="mt-2">
              <UserSocialTags
                verified={!!profile.is_verified}
                handles={{
                  telegram_handle: profile.telegram_handle ?? null,
                  x_handle: profile.x_handle ?? null,
                  instagram_handle: profile.instagram_handle ?? null,
                  github_handle: profile.github_handle ?? null,
                }}
              />
            </div>
            <div className="flex gap-4 mt-2 text-sm">
              <span>
                <b>{counts?.followers ?? 0}</b>{" "}
                <span className="text-muted-foreground">seguidores</span>
              </span>
              <span>
                <b>{counts?.following ?? 0}</b>{" "}
                <span className="text-muted-foreground">seguindo</span>
              </span>
            </div>
          </div>
        </div>
        {!isMe && (
          <div className="flex gap-2 mt-4">
            {user ? (
              <>
                <Button
                  onClick={() => toggleFollow.mutate()}
                  disabled={toggleFollow.isPending}
                  variant={iFollow ? "outline" : "default"}
                  className="flex-1"
                >
                  {iFollow ? (
                    <>
                      <UserCheck size={16} /> Seguindo
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} /> Seguir
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate({ to: "/mensagens/$userId", params: { userId: id } })}
                  className="flex-1"
                >
                  <MessageCircle size={16} /> Mensagem
                </Button>
              </>
            ) : (
              <Link to="/auth" className="flex-1">
                <Button className="w-full">Entrar para seguir</Button>
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Postagens</h2>
        {(activity ?? []).length === 0 ? (
          <div className="text-sm text-muted-foreground rounded-xl border bg-card p-6 text-center">
            Nenhuma postagem ainda.
          </div>
        ) : (
          activity?.map((it) => (
            <PostCard
              key={it.key}
              post={it.post}
              repostedBy={it.repostedBy ?? null}
              quoteComment={it.quoteComment ?? null}
            />
          ))
        )}
      </div>
    </div>
  );
}
