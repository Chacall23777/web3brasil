import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { AiAgentBadge } from "@/components/AiAgentBadge";

type Tab = "followers" | "following";

type UserRow = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  is_verified: boolean | null;
  account_type: string | null;
};

export function FollowersPanel({ userId }: { userId: string }) {
  const [tab, setTab] = useState<Tab | null>(null);

  const { data: counts } = useQuery({
    queryKey: ["follow-counts", userId],
    queryFn: async () => {
      const [{ count: followers }, { count: following }] = await Promise.all([
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", userId),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", userId),
      ]);
      return { followers: followers ?? 0, following: following ?? 0 };
    },
  });

  const { data: list, isLoading } = useQuery({
    queryKey: ["follow-list", userId, tab],
    enabled: !!tab,
    queryFn: async () => {
      if (!tab) return [];
      const col = tab === "followers" ? "follower_id" : "following_id";
      const filterCol = tab === "followers" ? "following_id" : "follower_id";
      const { data } = await supabase
        .from("follows")
        .select(`user:profiles!follows_${col}_fkey(id, display_name, avatar_url, is_verified, account_type)`)
        .eq(filterCol, userId)
        .limit(200);
      return ((data ?? []) as any[]).map((r) => r.user).filter(Boolean) as UserRow[];
    },
  });

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex gap-6 text-sm">
        <button
          type="button"
          onClick={() => setTab(tab === "followers" ? null : "followers")}
          className={`hover:text-primary transition ${tab === "followers" ? "text-primary" : ""}`}
        >
          <b className="text-base">{counts?.followers ?? 0}</b>{" "}
          <span className="text-muted-foreground">seguidores</span>
        </button>
        <button
          type="button"
          onClick={() => setTab(tab === "following" ? null : "following")}
          className={`hover:text-primary transition ${tab === "following" ? "text-primary" : ""}`}
        >
          <b className="text-base">{counts?.following ?? 0}</b>{" "}
          <span className="text-muted-foreground">seguindo</span>
        </button>
      </div>

      {tab && (
        <div className="border-t pt-3 space-y-2 max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="text-xs text-muted-foreground">Carregando…</div>
          ) : (list ?? []).length === 0 ? (
            <div className="text-xs text-muted-foreground">
              {tab === "followers" ? "Ninguém te segue ainda." : "Você ainda não segue ninguém."}
            </div>
          ) : (
            list!.map((u) => (
              <Link
                key={u.id}
                to="/u/$id"
                params={{ id: u.id }}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-muted transition"
              >
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold">
                    {(u.display_name ?? "?")[0]}
                  </div>
                )}
                <div className="text-sm flex items-center gap-1 min-w-0">
                  <span className="truncate">{u.display_name ?? "Usuário"}</span>
                  {u.account_type === "ai_agent" && <AiAgentBadge />}
                  {u.is_verified && u.account_type !== "ai_agent" && <VerifiedBadge size={14} />}
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
