import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { linkifyText } from "@/lib/linkify";

export const Route = createFileRoute("/mensagens/$userId")({
  component: Thread,
});

type Msg = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
};

function Thread() {
  const { userId } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: other } = useQuery({
    queryKey: ["public-profile", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .eq("id", userId)
        .maybeSingle();
      return data;
    },
  });

  const { data: messages } = useQuery({
    queryKey: ["dm-thread", user?.id, userId],
    enabled: !!user,
    queryFn: async (): Promise<Msg[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("direct_messages")
        .select("id, sender_id, recipient_id, content, created_at")
        .or(
          `and(sender_id.eq.${user.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${user.id})`,
        )
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Msg[];
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`dm-thread-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        (payload) => {
          const m = payload.new as Msg;
          const involved =
            (m.sender_id === user.id && m.recipient_id === userId) ||
            (m.sender_id === userId && m.recipient_id === user.id);
          if (!involved) return;
          qc.setQueryData<Msg[]>(["dm-thread", user.id, userId], (old) => {
            if (!old) return [m];
            if (old.some((x) => x.id === m.id)) return old;
            return [...old, m];
          });
          qc.invalidateQueries({ queryKey: ["conversations", user.id] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, userId, qc]);

  const send = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Entre para enviar");
      const content = text.trim();
      if (!content) return;
      const { error } = await supabase
        .from("direct_messages")
        .insert({ sender_id: user.id, recipient_id: userId, content });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["dm-thread", user?.id, userId] });
      qc.invalidateQueries({ queryKey: ["conversations", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (text.trim()) send.mutate();
    }
  };

  if (!user) return null;

  return (
    <>
      <header className="px-4 py-3 border-b flex items-center gap-3">
        <Link to="/u/$id" params={{ id: userId }} className="flex items-center gap-3 hover:opacity-80">
          {other?.avatar_url ? (
            <img src={other.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="h-9 w-9 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
              {(other?.display_name ?? "?")[0]}
            </div>
          )}
          <div className="font-medium text-sm">{other?.display_name ?? "Usuário"}</div>
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[55vh]">
        {(messages ?? []).length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">Nenhuma mensagem ainda. Diga olá!</div>
        )}
        {messages?.map((m) => {
          const mine = m.sender_id === user.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                  mine
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                }`}
              >
                {linkifyText(m.content)}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); if (text.trim()) send.mutate(); }}
        className="border-t p-3 flex gap-2 items-end"
      >
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder="Escreva uma mensagem…"
          rows={1}
          maxLength={4000}
          className="flex-1 resize-none min-h-[40px] max-h-32"
        />
        <Button type="submit" disabled={send.isPending || !text.trim()} size="icon">
          <Send size={16} />
        </Button>
      </form>
    </>
  );
}
