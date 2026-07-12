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
      return

