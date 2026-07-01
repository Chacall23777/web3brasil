import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { fileToResizedDataUrl } from "@/lib/image";
import { toast } from "sonner";

export const Route = createFileRoute("/perfil")({
  component: PerfilPage,
  head: () => ({ meta: [{ title: "Meu perfil — WEB3BRASIL" }] }),
});

function PerfilPage() {
  const { user, profile, refreshProfile, loading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [tg, setTg] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [user, loading, navigate]);
  useEffect(() => {
    if (profile) {
      setName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
      setTg(profile.telegram ?? "");
      setAvatar(profile.avatar_url ?? null);
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.from("profiles").update({
        display_name: name.trim() || "Usuário",
        bio: bio.trim() || null,
        telegram: tg.trim() || null,
        avatar_url: avatar,
      }).eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: async () => { await refreshProfile(); toast.success("Perfil salvo"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleAvatar = async (f: File | undefined) => {
    if (!f) return;
    try { setAvatar(await fileToResizedDataUrl(f, 256, 0.85)); }
    catch { toast.error("Não deu para processar a imagem"); }
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-xl px-4 py-6 space-y-6">
      <h1 className="font-display text-2xl font-bold">Meu perfil</h1>

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
          <p className="text-xs text-muted-foreground">Aparece como ícone clicável nas suas postagens.</p>
        </div>

        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
