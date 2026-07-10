import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Repeat2, Quote } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function RepostButton({ postId }: { postId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [comment, setComment] = useState("");

  const { data: info } = useQuery({
    queryKey: ["reposts", postId, user?.id ?? "anon"],
    queryFn: async () => {
      const [{ count }, mine] = await Promise.all([
        supabase
          .from("reposts")
          .select("*", { count: "exact", head: true })
          .eq("original_post_id", postId),
        user
          ? supabase
              .from("reposts")
              .select("id")
              .eq("original_post_id", postId)
              .eq("user_id", user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      return { count: count ?? 0, reposted: !!mine.data };
    },
  });

  // Nota: sem subscription de realtime por post aqui de propósito.
  // Cada RepostButton renderizado (um por post no feed) abriria seu próprio
  // canal WebSocket — com 60 posts na tela isso vira 60 conexões simultâneas,
  // pesando bastante a página. A contagem já se atualiza para quem faz a ação
  // (via invalidateQueries no onSuccess da mutação abaixo).

  const doRepost = useMutation({
    mutationFn: async (payload: { comment: string | null }) => {
      if (!user) throw new Error("Entre para repostar");
      if (info?.reposted) {
        const { error } = await supabase
          .from("reposts")
          .delete()
          .eq("original_post_id", postId)
          .eq("user_id", user.id);
        if (error) throw error;
        return "removed" as const;
      }
      const { error } = await supabase.from("reposts").insert({
        original_post_id: postId,
        user_id: user.id,
        comment: payload.comment,
      } as any);
      if (error) throw error;
      return "created" as const;
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["reposts", postId] });
      qc.invalidateQueries({ queryKey: ["feed"] });
      setQuoteOpen(false);
      setComment("");
      toast.success(r === "created" ? "Repostado!" : "Repost desfeito");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const count = info?.count ?? 0;
  const active = info?.reposted;

  return (
    <>
      <div className="inline-flex items-center">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={active ? "text-emerald-500 hover:text-emerald-500" : ""}
              aria-label="Repostar"
            >
              <Repeat2 size={16} className={active ? "fill-current" : ""} />
              <span className="ml-1 tabular-nums">{count}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onClick={() => doRepost.mutate({ comment: null })}
              disabled={doRepost.isPending || !user}
            >
              <Repeat2 size={14} className="mr-2" />
              {active ? "Desfazer repost" : "Repostar"}
            </DropdownMenuItem>
            {!active && (
              <DropdownMenuItem onClick={() => setQuoteOpen(true)} disabled={!user}>
                <Quote size={14} className="mr-2" />
                Repostar com comentário
              </DropdownMenuItem>
            )}
            {count > 0 && (
              <DropdownMenuItem onClick={() => setListOpen(true)}>
                Ver quem repostou
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={quoteOpen} onOpenChange={setQuoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Repostar com comentário</DialogTitle>
          </DialogHeader>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Adicione um comentário…"
            rows={4}
            maxLength={2000}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuoteOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => doRepost.mutate({ comment: comment.trim() || null })}
              disabled={doRepost.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Repostar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RepostersDialog postId={postId} open={listOpen} onOpenChange={setListOpen} />
    </>
  );
}

function RepostersDialog({
  postId,
  open,
  onOpenChange,
}: {
  postId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data } = useQuery({
    queryKey: ["repost-users", postId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reposts")
        .select("user_id, created_at, profiles(display_name, avatar_url)")
        .eq("original_post_id", postId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quem repostou</DialogTitle>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto space-y-2">
          {(data ?? []).map((r: any) => (
            <Link
              key={r.user_id}
              to="/u/$id"
              params={{ id: r.user_id }}
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted"
            >
              {r.profiles?.avatar_url ? (
                <img
                  src={r.profiles.avatar_url}
                  alt=""
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : (
                <div className="h-9 w-9 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
                  {(r.profiles?.display_name ?? "?")[0]}
                </div>
              )}
              <span className="text-sm font-medium">{r.profiles?.display_name ?? "Usuário"}</span>
            </Link>
          ))}
          {(!data || data.length === 0) && (
            <div className="text-sm text-muted-foreground text-center py-6">Ninguém ainda.</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

