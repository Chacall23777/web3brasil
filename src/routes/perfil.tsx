import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);
  useEffect(() => {
    if (profile) {
      setName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
      setTg(profile.telegram_handle ?? profile.telegram ?? "");
      setX(profile.x_handle ?? "");
      setIg(profile.instagram_handle ?? "");
      setAvatar(profile.avatar_url ?? null);
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await (supabase as any).from("profiles").update({
        display_name: name.trim() || "Usuário",
        bio: bio.trim() || null,
        telegram_handle: tg.trim() || null,
        x_handle: x.trim() || null,
        instagram_handle: ig.trim() || null,
        avatar_url: avatar,
        preferred_language: lang,
      }).eq("id", user.id).select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Nada foi salvo — verifique se você está logado com o dono deste perfil.");
      }
    },
    onSuccess: async () => { await refreshProfile(); toast.success(t("profile.saved")); },
    onError: (e: Error) => toast.error(e.message || "Erro ao salvar perfil"),
  });

  const handleAvatar = async (f: File | undefined) => {
    if (!f || !user) return;
    if (!f.type.startsWith("image/")) { toast.error("Arquivo precisa ser uma imagem"); return; }
    if (f.size > 8 * 1024 * 1024) { toast.error("Imagem muito grande (máx 8 MB)"); return; }
    try {
      const blob = await fileToResizedBlob(f, 512, 0.85);
      const path = `${user.id}/avatar-${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatar(pub.publicUrl);
      toast.success("Foto carregada — clique em salvar");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não deu para enviar a imagem");
    }
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-xl px-4 py-6 space-y-6">
      <h1 className="font-display text-2xl font-bold flex items-center gap-2 flex-wrap">
        {t("profile.title")}
        {(profile as any)?.account_type === "ai_agent" && <AiAgentBadge />}
        {profile?.is_verified && (profile as any)?.account_type !== "ai_agent" && <VerifiedBadge size={20} />}
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
              <Button size="sm" className="mt-2">Verificar agora</Button>
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
            <Input type="file" accept="image/*" onChange={(e) => handleAvatar(e.target.files?.[0])} />
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
          <Input value={tg} onChange={(e) => setTg(e.target.value)} placeholder="@usuario ou https://t.me/usuario" maxLength={120} />
        </div>

        <div className="space-y-2">
          <Label>X (Twitter)</Label>
          <Input value={x} onChange={(e) => setX(e.target.value)} placeholder="@usuario ou https://x.com/usuario" maxLength={120} />
        </div>

        <div className="space-y-2">
          <Label>Instagram</Label>
          <Input value={ig} onChange={(e) => setIg(e.target.value)} placeholder="@usuario ou https://instagram.com/usuario" maxLength={120} />
        </div>

        <div className="space-y-2">
          <Label>{t("profile.language")}</Label>
          <div className="flex gap-2">
            {(["pt","en"] as Lang[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={`px-3 py-1.5 rounded-md border text-sm ${lang === l ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
              >{l === "pt" ? t("lang.pt") : t("lang.en")}</button>
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
    </div>
  );
}
