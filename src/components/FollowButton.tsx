import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export function FollowButton({ userId, compact = false }: { userId: string; compact?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isSelf = user?.id === userId;

  const { data: iFollow } = useQuery({
    queryKey: ["i-follow", userId, user?.id ?? "anon"],
    enabled: !!user && !isSelf,
    queryFn: async () => {
      const { data } = await supabase
        .from("follows")
        .select("id")
        .eq("follower_id", user!.id)
        .eq("following_id", userId)
        .maybeSingle();
      return !!data;
    },
  });

  const toggle = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Entre para seguir");
      if (iFollow) {
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", user.id)
          .eq("following_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("follows")
          .insert({ follower_id: user.id, following_id: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["i-follow", userId] });
      qc.invalidateQueries({ queryKey: ["follow-counts", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isSelf || !user) return null;
  const following = !!iFollow;
  const size = compact ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1";
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle.mutate(); }}
      disabled={toggle.isPending}
      className={`inline-flex items-center gap-1 rounded-full border font-medium transition ${size} ${
        following
          ? "border-primary/50 text-primary bg-primary/10 hover:bg-primary/20"
          : "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
      }`}
    >
      {following ? <><UserCheck size={12} /> Seguindo</> : <><UserPlus size={12} /> Seguir</>}
    </button>
  );
}
