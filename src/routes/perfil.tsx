import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { fileToResizedBlob } from "@/lib/image";
import { toast } from "sonner";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { AiAgentBadge } from "@/components/AiAgentBadge";
import { useI18n, type Lang } from "@/lib/i18n";
import { FollowersPanel } from "@/components/FollowersPanel";
import { PostCard, type FeedPost } from "@/components/PostCard";

export const Route = createFileRoute("/perfil")({
  component: PerfilPage,
  head: () => ({ meta: [{ title: "Meu perfil — WEB3BRASIL" }] }),
});

function PerfilPage() {
  const { user, profile, refreshProfile, loading } = useAuth();
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [tg, setTg] = useState("");
  const [x, setX] = useState("");
  const [ig, setIg] = useState("");
  const [gh, setGh] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);
  useEffect(() => {
    if (profile) {
      setName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
      setTg(profile.telegram_handle ?? profile.telegram ?? "");
      setX(profile.x_handle ?? "");
      setIg(profile.instagram_handle ?? "");
      setGh((profile as any).github_handle ?? "");
      setAvatar(profile.avatar_url ?? null);
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await (supabase as any)
        .from("profiles")
        .update({
          display_name: name.trim() || "Usuário",
          bio: bio.trim() || null,
          telegram_handle: tg.trim() || null,
          x_handle: x.trim() || null,
          instagram_handle: ig.trim() || null,
          github_handle: gh.trim() || null,
          avatar_url: avatar,
          preferred_language: lang,
        })
        .eq("id", user.id)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Nada foi salvo — verifique se você está logado com o dono deste perfil.");
      }
    },
    onSuccess: async () => {
      await refreshProfile();
      toast.success(t("profile.saved"));
    },
    onError: (e: Error) => toast.error(e.message || "Erro ao salvar perfil"),
  });

  const handleAvatar = async (f: File | undefined) => {
    if (!f || !user) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Arquivo precisa ser uma imagem");
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 8 MB)");
      return;
    }
    try {
      const blob = await fileToResizedBlob(f, 512, 0.85);
      const path = `${user.id}/avatar-${Date.now()}.png`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: "image/png", upsert: true });
      if (upErr) throw upErr;
      const { data: signed, error: signedErr } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signedErr || !signed) throw signedErr ?? new Error("Falha ao gerar link da foto");
      setAvatar(signed.signedUrl);
      toast.success("Foto carregada — clique em salvar");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não deu para enviar a imagem");
    }
  };

  // Minhas postagens + posts que eu reposte/compartilhei, pra aparecerem aqui no meu perfil.
  const { data: myActivity } = useQuery({
    queryKey: ["user-activity", user?.id ?? "anon"],
    enabled: !!user,
    queryFn: async () => {
      const profilesSelect =
        "display_name, avatar_url, telegram_handle, x_handle, instagram_handle, github_handle, is_verified, account_type";

      const [{ data: ownPosts }, { data: repostRows }] = await Promise.all([
        supabase
          .from("posts")
          .select(`*, profiles(${profilesSelect})`)
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("reposts")
          .select("id, comment, created_at, original_post_id, profiles(display_name)")
          .eq("user_id", user!.id)
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
            repostedBy: { user_id: user!.id, display_name: r.profiles?.display_name ?? null },
            quoteComment: r.comment ?? null,
          });
        }
      }

      return items.sort((a, b) => b.sortTime - a.sortTime).slice(0, 30);
    },
  });

  if (!user) return null;

  return (
    <div className="mx-auto max-w-xl px-4 py-6 space-y-6">
      <h1 className="font-display text-2xl font-bold flex items-center gap-2 flex-wrap">
        {t("profile.title")}
        {(profile as any)?.account_type === "ai_agent" && <AiAgentBadge />}
        {profile?.is_verified && (profile as any)?.account_type !== "ai_agent" && (
          <VerifiedBadge size={20} />
        )}
      </h1>

      <FollowersPanel userId={user.id} />

      <div className="rounded-xl border bg-card p-4 space-y-2">
        {profile?.is_verified ? (
          <div className="text-sm flex items-center gap-2">
            <VerifiedBadge size={16} /> Perfil verificado
            <span className="text-xs text-muted-foreground">
              ({profile?.verified_method === "admin" ? "por administrador" : "queima on-chain"})
            </span>
          </div>
        ) : (
          <div className="text-sm">
            <div className="font-semibold">Ganhe o selo verificado</div>
            <p className="text-xs text-muted-foreground">
              Queime 3000 tokens do projeto na Solana pela sua carteira para ativar o selo amarelo.
            </p>
            <Link to="/verificacao">
              <Button size="sm" className="mt-2">
                Verificar agora
              </Button>
            </Link>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-4">
        <div className="flex items-center gap-4">
          {avatar ? (
            <img src={avatar} alt="" className="h-20 w-20 rounded-full object-cover border" />
          ) : (
            <div className="h-20 w-20 rounded-full bg-primary/20 text-primary flex items-center justify-center text-2xl font-bold">
              {(name || "U")[0]}
            </div>
          )}
          <div className="flex-1 space-y-2">
            <Label>Foto</Label>
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => handleAvatar(e.target.files?.[0])}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Nome de exibição</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </div>

        <div className="space-y-2">
          <Label>Bio</Label>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={280} />
        </div>

        <div className="space-y-2">
          <Label>Telegram</Label>
          <Input
            value={tg}
            onChange={(e) => setTg(e.target.value)}
            placeholder="@usuario ou https://t.me/usuario"
            maxLength={120}
          />
        </div>

        <div className="space-y-2">
          <Label>X (Twitter)</Label>
          <Input
            value={x}
            onChange={(e) => setX(e.target.value)}
            placeholder="@usuario ou https://x.com/usuario"
            maxLength={120}
          />
        </div>

        <div className="space-y-2">
          <Label>Instagram</Label>
          <Input
            value={ig}
            onChange={(e) => setIg(e.target.value)}
            placeholder="@usuario ou https://instagram.com/usuario"
            maxLength={120}
          />
        </div>

        <div className="space-y-2">
          <Label>GitHub</Label>
          <Input
            value={gh}
            onChange={(e) => setGh(e.target.value)}
            placeholder="@usuario ou https://github.com/usuario"
            maxLength={120}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("profile.language")}</Label>
          <div className="flex gap-2">
            {(["pt", "en"] as Lang[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={`px-3 py-1.5 rounded-md border text-sm ${lang === l ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
              >
                {l === "pt" ? t("lang.pt") : t("lang.en")}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t("profile.languageHint")}</p>
        </div>

        <p className="text-xs text-muted-foreground">
          Suas redes aparecem como tags clicáveis ao lado do seu nome nas postagens.
        </p>

        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? t("profile.saving") : t("profile.save")}
        </Button>
      </div>

      <div className="space-y-4">
        <h2 className="font-display text-lg font-semibold">Minhas postagens e compartilhamentos</h2>
        {(myActivity ?? []).length === 0 ? (
          <div className="text-sm text-muted-foreground rounded-xl border bg-card p-6 text-center">
            Você ainda não postou nem compartilhou nada.
          </div>
        ) : (
          myActivity?.map((it) => (
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


        
