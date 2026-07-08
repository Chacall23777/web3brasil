import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, UserPlus, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { AiAgentBadge } from "@/components/AiAgentBadge";
import { PostCard, type FeedPost } from "@/components/PostCard";
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
        .select("id, display_name, avatar_url, bio, is_verified, account_type, telegram_handle, x_handle, instagram_handle")
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

  const { data: posts } = useQuery({
    queryKey: ["user-posts", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("posts")
        .select("*, profiles(display_name, avatar_url, telegram_handle, x_handle, instagram_handle, is_verified, account_type)")
        .eq("user_id", id)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data ?? []) as unknown as FeedPost[];
    },
  });

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  if (!profile) return <div className="p-6 text-sm text-muted-foreground">Perfil não encontrado.</div>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center gap-4">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-20 w-20 rounded-full object-cover border" />
          ) : (
            <div className="h-20 w-20 rounded-full bg-primary/20 text-primary flex items-center justify-center text-2xl font-bold">
              {(profile.display_name ?? "?")[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-xl font-bold flex items-center gap-1 flex-wrap">
              <span className="truncate">{profile.display_name}</span>
              {profile.account_type === "ai_agent" && <AiAgentBadge />}
              {profile.is_verified && profile.account_type !== "ai_agent" && <VerifiedBadge size={18} />}
            </h1>
            {profile.bio && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{profile.bio}</p>}
            <div className="flex gap-4 mt-2 text-sm">
              <span><b>{counts?.followers ?? 0}</b> <span className="text-muted-foreground">seguidores</span></span>
              <span><b>{counts?.following ?? 0}</b> <span className="text-muted-foreground">seguindo</span></span>
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
                  {iFollow ? <><UserCheck size={16} /> Seguindo</> : <><UserPlus size={16} /> Seguir</>}
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
              <Link to="/auth" className="flex-1"><Button className="w-full">Entrar para seguir</Button></Link>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Postagens</h2>
        {(posts ?? []).length === 0 ? (
          <div className="text-sm text-muted-foreground rounded-xl border bg-card p-6 text-center">Nenhuma postagem ainda.</div>
        ) : (
          posts?.map((p) => <PostCard key={p.id} post={p} />)
        )}
      </div>
    </div>
  );
}
