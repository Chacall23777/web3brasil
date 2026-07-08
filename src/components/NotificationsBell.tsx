import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Bell, UserPlus, AtSign } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

type NotificationRow = {
  id: string;
  user_id: string;
  actor_id: string;
  type: "follow" | "mention";
  post_id: string | null;
  read_at: string | null;
  created_at: string;
  actor: { display_name: string; avatar_url: string | null } | null;
};

export function NotificationsBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { lang } = useI18n();
  const dateLocale = lang === "en" ? enUS : ptBR;
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["notifications", user?.id ?? "anon"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, user_id, actor_id, type, post_id, read_at, created_at, actor:profiles!notifications_actor_id_fkey(display_name, avatar_url)")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) {
        // fallback if FK relation not detected: do a two-step fetch
        const { data: rows } = await supabase
          .from("notifications")
          .select("id, user_id, actor_id, type, post_id, read_at, created_at")
          .order("created_at", { ascending: false })
          .limit(30);
        if (!rows) return [] as NotificationRow[];
        const ids = Array.from(new Set(rows.map((r: any) => r.actor_id)));
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, display_name, avatar_url")
          .in("id", ids);
        const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
        return rows.map((r: any) => ({ ...r, actor: map.get(r.actor_id) ?? null })) as NotificationRow[];
      }
      return (data ?? []) as unknown as NotificationRow[];
    },
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["notifications", user.id] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!user) return;
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .is("read_at", null);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const markOneRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id)
        .is("read_at", null);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  if (!user) return null;
  const items = data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 rounded-md hover:bg-muted"
          aria-label="Notificações"
        >
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <h4 className="text-sm font-semibold">Notificações</h4>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => markAllRead.mutate()}>
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">Nenhuma notificação ainda.</div>
          ) : (
            items.map((n) => {
              const name = n.actor?.display_name ?? "Alguém";
              const isMention = n.type === "mention" && n.post_id;
              const to = isMention ? "/post/$id" : "/u/$id";
              const params = isMention ? { id: n.post_id! } : { id: n.actor_id };
              return (
                <Link
                  key={n.id}
                  to={to}
                  params={params}
                  onClick={() => { markOneRead.mutate(n.id); setOpen(false); }}
                  className={`flex items-start gap-3 px-3 py-2.5 border-b hover:bg-muted transition ${!n.read_at ? "bg-primary/5" : ""}`}
                >
                  {n.actor?.avatar_url ? (
                    <img src={n.actor.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold shrink-0">
                      {name[0]}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm">
                      <span className="font-medium">{name}</span>{" "}
                      {n.type === "follow" ? "começou a te seguir." : "mencionou você em um post."}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                      {n.type === "follow" ? <UserPlus size={11} /> : <AtSign size={11} />}
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: dateLocale })}
                    </div>
                  </div>
                  {!n.read_at && <span className="mt-2 h-2 w-2 rounded-full bg-primary shrink-0" />}
                </Link>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
