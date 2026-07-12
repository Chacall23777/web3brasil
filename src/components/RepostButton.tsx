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

export function RepostButton({ postId, count: knownCount }: { postId: string; count?: number }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [comment, setComment] = useState("");

  const { data: mineReposted } = useQuery({
    queryKey: ["reposts-mine", postId, user?.id ?? "anon"],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("reposts")
        .select("id")
        .eq("original_post_id", postId)
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
  });
  const { data: liveCount } = useQuery({
    queryKey: ["reposts-count", postId],
    enabled: knownCount == null,
    queryFn: async () => {
      const { count } = await supabase
        .from("reposts")
        .select("*", { count: "exact", head: true })
        .eq("original_post_id", postId);
      return count ?? 0;
    },
  });
  const info = { count: knownCount ?? liveCount ?? 0, reposted: !!mineReposted };

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
    onSuccess: (result) => {
      toast.success(result === "removed" ? "Repost removido" : "Repost publicado");
      setQuoteOpen(false);
      setComment("");
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["reposts-count", postId] });
      qc.invalidateQueries({ queryKey: ["reposts-mine", postId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const submitQuote = () => doRepost.mutate({ comment: comment.trim() || null });

  return (
    <>
      <DropdownMenu open={listOpen} onOpenChange={setListOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={info.reposted ? "text-primary" : ""}
            aria-label="Repostar"
          >
            <Repeat2 size={22} />
            {info.count > 0 && <span className="text-xs">{info.count}</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => doRepost.mutate({ comment: null })}>
            <Repeat2 size={16} />
            {info.reposted ? "Remover repost" : "Repostar"}
          </DropdownMenuItem>
          {!info.reposted && (
            <DropdownMenuItem onClick={() => setQuoteOpen(true)}>
              <Quote size={16} />
              Repostar com comentário
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link to="/post/$id" params={{ id: postId }}>
              Ver postagem
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={quoteOpen} onOpenChange={setQuoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Repostar com comentário</DialogTitle>
          </DialogHeader>
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Adicione um comentário"
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuoteOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submitQuote} disabled={doRepost.isPending}>
              Publicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
