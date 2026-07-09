import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fileToResizedDataUrl } from "@/lib/image";
import { toast } from "sonner";
import { Trash2, Pencil, Power, PowerOff, Globe, X as XClose } from "lucide-react";
import { XIcon, TelegramIcon } from "./SocialIcons";

type AdRow = {
  id: string;
  image_url: string;
  title: string | null;
  tg_link: string | null;
  x_link: string | null;
  website_link: string | null;
  duration_days: number;
  created_at: string;
  expires_at: string;
  is_active: boolean;
};

const DURATIONS = [7, 15, 30] as const;

export function AdsAdmin() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<AdRow | null>(null);

  const [image, setImage] = useState<string>("");
  const [title, setTitle] = useState("");
  const [tg, setTg] = useState("");
  const [x, setX] = useState("");
  const [web, setWeb] = useState("");
  const [duration, setDuration] = useState<7 | 15 | 30>(7);

  const resetForm = () => {
    setEditing(null);
    setImage(""); setTitle(""); setTg(""); setX(""); setWeb(""); setDuration(7);
  };

  const startEdit = (ad: AdRow) => {
    setEditing(ad);
    setImage(ad.image_url);
    setTitle(ad.title ?? "");
    setTg(ad.tg_link ?? "");
    setX(ad.x_link ?? "");
    setWeb(ad.website_link ?? "");
    setDuration(ad.duration_days as 7 | 15 | 30);
  };

  const { data: ads } = useQuery({
    queryKey: ["ads_admin"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("advertisements")
        .select("*")
        .order("created_at", { ascending: false });
      return (data ?? []) as AdRow[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      if (!image) throw new Error("Envie uma imagem para o anúncio");
      if (!DURATIONS.includes(duration)) throw new Error("Duração inválida");
      const validateLink = (raw: string, label: string): string | null => {
        const v = raw.trim();
        if (!v) return null;
        const safe = safeHttpUrl(v);
        if (!safe) throw new Error(`${label} inválido — use uma URL http(s) completa`);
        return safe;
      };
      const payload = {
        image_url: image,
        title: title.trim() || null,
        tg_link: validateLink(tg, "Link do Telegram"),
        x_link: validateLink(x, "Link do X"),
        website_link: validateLink(web, "Link do site"),
        duration_days: duration,
      };
      if (editing) {
        const { error } = await (supabase as any)
          .from("advertisements").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("advertisements").insert({ ...payload, created_by_admin_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Anúncio atualizado" : "Anúncio criado");
      resetForm();
      qc.invalidateQueries({ queryKey: ["ads_admin"] });
      qc.invalidateQueries({ queryKey: ["ads_active"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async (ad: AdRow) => {
      const { error } = await (supabase as any)
        .from("advertisements").update({ is_active: !ad.is_active }).eq("id", ad.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ads_admin"] });
      qc.invalidateQueries({ queryKey: ["ads_active"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("advertisements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["ads_admin"] });
      qc.invalidateQueries({ queryKey: ["ads_active"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleImg = async (f: File | undefined) => {
    if (!f) return;
    try {
      const url = await fileToResizedDataUrl(f, 640, 0.85);
      setImage(url);
    } catch {
      toast.error("Não foi possível processar a imagem");
    }
  };

  const now = Date.now();

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{editing ? "Editar anúncio" : "Novo anúncio"}</h3>
          {editing && (
            <Button variant="ghost" size="sm" onClick={resetForm}>
              <XClose size={14} /> Cancelar edição
            </Button>
          )}
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Imagem do anúncio</label>
          <div className="flex items-center gap-3 mt-1">
            <Input type="file" accept="image/*" onChange={(e) => handleImg(e.target.files?.[0])} className="flex-1" />
            {image && <img src={image} alt="" className="h-14 w-14 rounded-lg object-cover border" />}
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Título (opcional)</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Ex: Novo drop do meu token" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1"><TelegramIcon width={12} height={12} /> Telegram (opcional)</label>
            <Input value={tg} onChange={(e) => setTg(e.target.value)} placeholder="https://t.me/…" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1"><XIcon width={12} height={12} /> X (opcional)</label>
            <Input value={x} onChange={(e) => setX(e.target.value)} placeholder="https://x.com/…" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground flex items-center gap-1"><Globe size={12} /> Site (opcional)</label>
            <Input value={web} onChange={(e) => setWeb(e.target.value)} placeholder="https://…" />
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground">Duração</label>
          <div className="flex gap-2 mt-1">
            {DURATIONS.map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => setDuration(d)}
                className={`px-4 py-2 rounded-md border text-sm font-semibold transition ${
                  duration === d
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted"
                }`}
              >
                {d} dias
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending || !image}>
            {save.isPending ? "Salvando…" : editing ? "Salvar alterações" : "Publicar anúncio"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card divide-y">
        <div className="p-3 text-sm font-semibold">Anúncios ({ads?.length ?? 0})</div>
        {(ads ?? []).map((ad) => {
          const expired = new Date(ad.expires_at).getTime() < now;
          return (
            <div key={ad.id} className="p-3 flex items-center gap-3 flex-wrap">
              <img src={ad.image_url} alt="" className="h-12 w-12 rounded-lg object-cover border shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate flex items-center gap-2">
                  {ad.title || <span className="text-muted-foreground italic">Sem título</span>}
                  {expired ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-destructive/20 text-destructive border border-destructive/40">expirado</span>
                  ) : !ad.is_active ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border">inativo</span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-600 border border-green-500/40">ativo</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {ad.duration_days}d · expira {new Date(ad.expires_at).toLocaleString("pt-BR")}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => startEdit(ad)} aria-label="Editar">
                <Pencil size={14} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => toggleActive.mutate(ad)} aria-label="Ativar/Desativar">
                {ad.is_active ? <PowerOff size={14} /> : <Power size={14} />}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir este anúncio?")) remove.mutate(ad.id); }} aria-label="Excluir">
                <Trash2 size={14} />
              </Button>
            </div>
          );
        })}
        {(!ads || ads.length === 0) && (
          <div className="p-6 text-center text-sm text-muted-foreground">Nenhum anúncio ainda.</div>
        )}
      </div>
    </div>
  );
}
