import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR, enUS } from "date-fns/locale";
import { Heart, MessageCircle, Trash2, FileText, Download, Pencil, X, Check, Languages } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { translateWithMyMemory, cachePostTranslation } from "@/lib/translate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { TokenChart } from "./TokenChart";
import { ShareButtons } from "./ShareButtons";
import { TelegramIcon } from "./SocialIcons";
import { VerifiedBadge } from "./VerifiedBadge";
import { UserSocialTags } from "./UserSocialTags";
import { safeHttpUrl } from "@/lib/safe-url";

export type FeedPost = {
  id: string;
  user_id: string;
  type: "text" | "token";
  title: string | null;
  content: string | null;
  image_url: string | null;
  token_name: string | null;
  token_symbol: string | null;
  token_contract: string | null;
  token_chain: string | null;
  token_link: string | null;
  file_url?: string | null;
  file_name?: string | null;
  created_at: string;
  edited_at?: string | null;
  content_original?: string | null;
  content_pt?: string | null;
  content_en?: string | null;
  original_language?: "pt" | "en" | null;
  profiles: {
    display_name: string;
    avatar_url: string | null;
    telegram: string | null;
    telegram_handle?: string | null;
    x_handle?: string | null;
    instagram_handle?: string | null;
    is_verified?: boolean | null;
  } | null;
};

export function PostCard({ post, showComments = false }: { post: FeedPost; showComments?: boolean }) {
  const { user, profile, isAdmin } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { t, lang } = useI18n();
  const dateLocale = lang === "en" ? enUS : ptBR;
  const author = post.profiles;
  const postUrl = typeof window !== "undefined"
    ? `${window.location.origin}/post/${post.id}`
    : `/post/${post.id}`;

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title ?? "");
  const [editContent, setEditContent] = useState(post.content ?? "");

  const { data: likeInfo } = useQuery({
    queryKey: ["post-likes", post.id, user?.id ?? "anon"],
    queryFn: async () => {
      const [{ count }, mine] = await Promise.all([
        supabase.from("likes").select("*", { count: "exact", head: true }).eq("post_id", post.id),
        user
          ? supabase.from("likes").select("id").eq("post_id", post.id).eq("user_id", user.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      return { count: count ?? 0, liked: !!mine.data };
    },
  });

  const toggleLike = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Entre para curtir");
      if (likeInfo?.liked) {
        await supabase.from("likes").delete().eq("post_id", post.id).eq("user_id", user.id);
      } else {
        await supabase.from("likes").insert({ post_id: post.id, user_id: user.id });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["post-likes", post.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePost = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("posts").delete().eq("id", post.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Postagem removida");
      qc.invalidateQueries({ queryKey: ["feed"] });
      navigate({ to: "/comunidade" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveEdit = useMutation({
    mutationFn: async () => {
      const patch: Record<string, any> = { content: editContent.trim() || null };
      if (post.type === "text") patch.title = editTitle.trim() || null;
      const { error } = await (supabase as any).from("posts").update(patch).eq("id", post.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Postagem atualizada");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["feed"] });
      qc.invalidateQueries({ queryKey: ["post", post.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isOwner = !!user && user.id === post.user_id;
  const canEdit = (isOwner && !!profile?.is_verified) || isAdmin;
  const canDelete = user && (isOwner || isAdmin);

  return (
    <article className="rounded-xl border bg-card overflow-hidden">
      <header className="p-4 flex items-center gap-3">
        {author?.avatar_url ? (
          <img src={author.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <div className="h-10 w-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
            {(author?.display_name ?? "?")[0]}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate flex items-center gap-1">
            <span className="truncate">{author?.display_name ?? "Usuário"}</span>
            {author?.is_verified && <VerifiedBadge size={14} />}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
            <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: dateLocale })}</span>
            {post.edited_at && (
              <span
                className="italic text-[10px] px-1.5 py-0.5 rounded bg-muted/50"
                title={new Date(post.edited_at).toLocaleString(lang === "en" ? "en-US" : "pt-BR")}
              >
                {t("post.edited")} · {formatDistanceToNow(new Date(post.edited_at), { addSuffix: true, locale: dateLocale })}
              </span>
            )}
            {author && (
              <UserSocialTags
                verified={!!author.is_verified}
                handles={{
                  telegram_handle: author.telegram_handle ?? null,
                  x_handle: author.x_handle ?? null,
                  instagram_handle: author.instagram_handle ?? null,
                }}
              />
            )}
          </div>
        </div>
        {canEdit && !editing && (
          <button onClick={() => { setEditTitle(post.title ?? ""); setEditContent(post.content ?? ""); setEditing(true); }}
            className="p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-muted" aria-label={t("post.edit")}>
            <Pencil size={16} />
          </button>
        )}
        {canDelete && (
          <button onClick={() => confirm(t("post.confirmDelete")) && deletePost.mutate()}
            className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted" aria-label={t("post.delete")}>
            <Trash2 size={16} />
          </button>
        )}
      </header>

      <div className="px-4 pb-3 space-y-3">
        {editing ? (
          <div className="space-y-2">
            {post.type === "text" && (
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder={t("post.title")}
              />
            )}
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={4}
              placeholder={t("post.content")}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => saveEdit.mutate()} disabled={saveEdit.isPending}>
                <Check size={14} /> {t("post.save")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                <X size={14} /> {t("post.cancel")}
              </Button>
            </div>
          </div>
        ) : post.type === "token" ? (
          <>
            <div className="flex items-start gap-3">
              {post.image_url && (
                <img src={post.image_url} alt="" className="h-16 w-16 rounded-lg object-cover border" />
              )}
              <div className="min-w-0">
                <h3 className="font-display text-xl font-bold leading-tight">
                  {post.token_name}
                  {post.token_symbol && <span className="ml-2 text-sm font-normal text-primary">${post.token_symbol}</span>}
                </h3>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Rede: <span className="uppercase">{post.token_chain}</span>
                  {post.token_contract && (
                    <> · <span className="font-mono break-all">{post.token_contract.slice(0, 8)}…{post.token_contract.slice(-6)}</span></>
                  )}
                </div>
                {(() => {
                  const safe = safeHttpUrl(post.token_link);
                  return safe ? (
                    <a href={safe} target="_blank" rel="noopener noreferrer nofollow ugc"
                      className="inline-block mt-1 text-xs text-primary hover:underline">
                      Site do projeto ↗
                    </a>
                  ) : null;
                })()}
              </div>
            </div>
            <TranslatedContent post={post} />
            <TokenChart chain={post.token_chain} contract={post.token_contract} />
          </>
        ) : (
          <>
            {post.title && <h3 className="font-display text-lg font-semibold">{post.title}</h3>}
            <TranslatedContent post={post} />
            {post.image_url && <img src={post.image_url} alt="" className="rounded-lg border max-h-96" />}
          </>
        )}
        {post.file_url && (
          <div className="rounded-lg border bg-muted/30 overflow-hidden">
            <div className="flex items-center gap-2 p-3 border-b">
              <FileText size={18} className="text-primary shrink-0" />
              <span className="text-sm font-medium truncate flex-1">{post.file_name ?? "Arquivo PDF"}</span>
              <a
                href={post.file_url}
                target="_blank"
                rel="noopener noreferrer"
                download={post.file_name ?? undefined}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Download size={14} /> Baixar
              </a>
            </div>
            <object data={`${post.file_url}#toolbar=1&view=FitH`} type="application/pdf" className="w-full h-[500px] bg-background">
              <div className="p-4 text-sm text-muted-foreground text-center">
                Não foi possível exibir o PDF no navegador.{" "}
                <a href={post.file_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Abrir em nova aba
                </a>
              </div>
            </object>
          </div>
        )}
      </div>

      <footer className="px-3 pb-3 flex items-center gap-1 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => toggleLike.mutate()} className={likeInfo?.liked ? "text-primary" : ""}>
          <Heart size={16} className={likeInfo?.liked ? "fill-current" : ""} /> {likeInfo?.count ?? 0}
        </Button>
        <Link to="/post/$id" params={{ id: post.id }}>
          <Button variant="ghost" size="sm"><MessageCircle size={16} /> {t("post.comment")}</Button>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <ShareButtons
            url={postUrl}
            text={post.type === "token" ? `${post.token_name} ($${post.token_symbol}) na WEB3BRASIL` : (post.title ?? "Post na WEB3BRASIL")}
          />
        </div>
      </footer>

      {showComments && <Comments postId={post.id} />}
    </article>
  );
}

function Comments({ postId }: { postId: string }) {
  const { user, profile } = useAuth();
  const { t: tc, lang } = useI18n();
  const dateLocale = lang === "en" ? enUS : ptBR;
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const { data: comments } = useQuery({
    queryKey: ["comments", postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("id, content, created_at, user_id, profiles(display_name, avatar_url, is_verified, telegram_handle, x_handle, instagram_handle)")
        .eq("post_id", postId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Entre para comentar");
      const content = text.trim();
      if (!content) return;
      const { error } = await supabase.from("comments").insert({ post_id: postId, user_id: user.id, content });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      qc.invalidateQueries({ queryKey: ["comments", postId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="border-t px-4 py-3 space-y-3 bg-muted/20">
      <h4 className="text-sm font-semibold">{tc("post.comments")}</h4>
      <div className="space-y-3">
        {(comments ?? []).map((c: any) => (
          <div key={c.id} className="flex gap-2">
            {c.profiles?.avatar_url ? (
              <img src={c.profiles.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                {(c.profiles?.display_name ?? "?")[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
                <span className="font-medium text-foreground inline-flex items-center gap-1">
                  {c.profiles?.display_name ?? "Usuário"}
                  {c.profiles?.is_verified && <VerifiedBadge size={12} />}
                </span>
                <span>· {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: dateLocale })}</span>
                {c.profiles && (
                  <UserSocialTags
                    verified={!!c.profiles.is_verified}
                    handles={{
                      telegram_handle: c.profiles.telegram_handle ?? null,
                      x_handle: c.profiles.x_handle ?? null,
                      instagram_handle: c.profiles.instagram_handle ?? null,
                    }}
                  />
                )}
              </div>
              <div className="text-sm whitespace-pre-wrap">{c.content}</div>
            </div>
          </div>
        ))}
        {comments?.length === 0 && <div className="text-sm text-muted-foreground">{tc("post.new.noComments")}</div>}
      </div>

      {user ? (
        <form
          onSubmit={(e) => { e.preventDefault(); add.mutate(); }}
          className="flex gap-2 items-start"
        >
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
              {(profile?.display_name ?? "?")[0]}
            </div>
          )}
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={tc("post.new.commentPlaceholder")} rows={2} maxLength={1000} className="flex-1" />
          <Button type="submit" disabled={add.isPending || !text.trim()}>{tc("post.new.commentSend")}</Button>
        </form>
      ) : (
        <div className="text-sm text-muted-foreground">
          <Link to="/auth" className="text-primary hover:underline">{tc("nav.signin")}</Link> {tc("post.new.signInToComment")}
        </div>
      )}
    </div>
  );
}

function TranslatedContent({ post }: { post: FeedPost }) {
  const { lang, t } = useI18n();
  const { user } = useAuth();
  const original = post.content_original ?? post.content ?? "";
  const originalLang: "pt" | "en" = (post.original_language as "pt" | "en") ?? "pt";
  const cached = lang === "pt" ? post.content_pt : post.content_en;
  const initialTranslated = originalLang === lang ? original : cached ?? null;

  const [translated, setTranslated] = useState<string | null>(initialTranslated);
  const [showOriginal, setShowOriginal] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const nextCached = lang === "pt" ? post.content_pt : post.content_en;
    const next = originalLang === lang ? original : nextCached ?? null;
    setTranslated(next);
    setFailed(false);
    setShowOriginal(false);
  }, [lang, post.id, post.content_pt, post.content_en, originalLang, original]);

  useEffect(() => {
    if (!original.trim()) return;
    if (originalLang === lang) return;
    if (translated) return;
    if (loading || failed) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const res = await translateWithMyMemory(original, originalLang, lang);
      if (cancelled) return;
      if (res.ok) {
        setTranslated(res.text);
        if (user) void cachePostTranslation(post.id, lang, res.text);
      } else {
        setFailed(true);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [lang, originalLang, original, translated, loading, failed, post.id, user]);

  if (!original.trim()) return null;

  const isAutoTranslated = originalLang !== lang && !!translated;
  const shown = showOriginal || !translated ? original : translated;

  return (
    <div className="space-y-1">
      <p className="text-sm whitespace-pre-wrap">{shown}</p>
      {failed && originalLang !== lang && (
        <p className="text-[11px] text-muted-foreground italic">{t("post.translationUnavailable")}</p>
      )}
      {isAutoTranslated && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Languages size={12} className="opacity-70" />
          <span>{t("post.autoTranslated")}</span>
          <button
            className="underline hover:text-primary"
            onClick={() => setShowOriginal((v) => !v)}
          >
            {showOriginal ? t("post.viewTranslation") : t("post.viewOriginal")}
          </button>
        </div>
      )}
    </div>
  );
}
