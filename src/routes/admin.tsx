import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { fileToResizedDataUrl } from "@/lib/image";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";
import { lookupToken, getUsdBrlRate, formatBRL, type TokenInfo } from "@/lib/token-lookup";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Admin — WEB3BRASIL" }] }),
});

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading) {
      if (!user) navigate({ to: "/auth" });
      else if (!isAdmin) navigate({ to: "/" });
    }
  }, [user, isAdmin, loading, navigate]);
  if (!user || !isAdmin) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
      <h1 className="font-display text-2xl font-bold">Admin</h1>
      <Tabs defaultValue="social">
        <TabsList>
          <TabsTrigger value="social">Redes sociais</TabsTrigger>
          <TabsTrigger value="team">Equipe</TabsTrigger>
          <TabsTrigger value="posts">Postagens</TabsTrigger>
          <TabsTrigger value="ticker">Cotação (Ticker)</TabsTrigger>
        </TabsList>
        <TabsContent value="social" className="mt-4"><SocialForm /></TabsContent>
        <TabsContent value="team" className="mt-4"><TeamAdmin /></TabsContent>
        <TabsContent value="posts" className="mt-4"><PostsAdmin /></TabsContent>
        <TabsContent value="ticker" className="mt-4"><TickerAdmin /></TabsContent>
      </Tabs>
    </div>
  );
}



function TickerAdmin() {
  const qc = useQueryClient();
  const { data: config } = useQuery({
    queryKey: ["ticker_config_admin"],
    queryFn: async () => (await supabase.from("ticker_config").select("*").eq("id", 1).maybeSingle()).data,
  });
  const { data: tokens } = useQuery({
    queryKey: ["ticker_tokens_admin"],
    queryFn: async () => (await supabase.from("ticker_tokens").select("*").order("ordem", { ascending: true })).data ?? [],
  });

  const [speed, setSpeed] = useState(15);
  useEffect(() => { if (config?.speed_seconds) setSpeed(config.speed_seconds); }, [config]);

  const saveSpeed = useMutation({
    mutationFn: async (v: number) => {
      const { error } = await supabase.from("ticker_config").upsert({ id: 1, speed_seconds: v, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Velocidade atualizada");
      qc.invalidateQueries({ queryKey: ["ticker_config"] });
      qc.invalidateQueries({ queryKey: ["ticker_config_admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [newAddr, setNewAddr] = useState("");
  const [preview, setPreview] = useState<TokenInfo | null>(null);
  const [brlRate, setBrlRate] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);

  async function handleSearch() {
    const addr = newAddr.trim();
    if (!addr) { toast.error("Cole o endereço do contrato"); return; }
    setSearching(true);
    setPreview(null);
    try {
      const [info, rate] = await Promise.all([lookupToken(addr), getUsdBrlRate()]);
      if (!info) { toast.error("Token não encontrado no DexScreener"); return; }
      setPreview(info);
      setBrlRate(rate);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao buscar token");
    } finally {
      setSearching(false);
    }
  }

  const addToken = useMutation({
    mutationFn: async () => {
      const addr = newAddr.trim();
      if (!addr || !preview) throw new Error("Busque o token antes de adicionar");
      const nextOrder = (tokens?.length ?? 0);
      const { error } = await supabase.from("ticker_tokens").insert({
        contract_address: addr, chain: preview.chain, ordem: nextOrder, ativo: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewAddr(""); setPreview(null);
      toast.success("Token adicionado");
      qc.invalidateQueries({ queryKey: ["ticker_tokens_admin"] });
      qc.invalidateQueries({ queryKey: ["ticker-listed"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateToken = useMutation({
    mutationFn: async (t: { id: string; ordem?: number; ativo?: boolean }) => {
      const { id, ...rest } = t;
      const { error } = await supabase.from("ticker_tokens").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ticker_tokens_admin"] });
      qc.invalidateQueries({ queryKey: ["ticker-listed"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteToken = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ticker_tokens").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["ticker_tokens_admin"] });
      qc.invalidateQueries({ queryKey: ["ticker-listed"] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <h3 className="font-semibold">Velocidade do ticker</h3>
        <p className="text-xs text-muted-foreground">Duração de uma volta completa em segundos. Menor = mais rápido.</p>
        <div className="flex items-center gap-3">
          <input
            type="range" min={5} max={60} step={1}
            value={speed} onChange={(e) => setSpeed(parseInt(e.target.value))}
            className="flex-1"
          />
          <Input
            type="number" min={5} max={300} value={speed}
            onChange={(e) => setSpeed(parseInt(e.target.value) || 15)}
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">s</span>
          <Button onClick={() => saveSpeed.mutate(speed)} disabled={saveSpeed.isPending}>Salvar</Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-3">
        <h3 className="font-semibold">Adicionar token</h3>
        <p className="text-xs text-muted-foreground">Cole o contrato e clique em Buscar. Os dados (nome, símbolo, rede, imagem, preço) são puxados em tempo real do DexScreener.</p>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
          <Input
            placeholder="Endereço do contrato"
            value={newAddr}
            onChange={(e) => { setNewAddr(e.target.value); setPreview(null); }}
          />
          <Button variant="outline" onClick={handleSearch} disabled={searching}>
            {searching ? <Loader2 className="animate-spin" size={16} /> : "Buscar"}
          </Button>
        </div>

        {preview && (
          <div className="rounded-lg border bg-background p-3 flex items-center gap-3">
            {preview.image ? (
              <img src={preview.image} alt="" className="h-10 w-10 rounded-full object-cover border" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-sm">
                {(preview.symbol || "?")[0]}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">
                {preview.name} <span className="text-muted-foreground">({preview.symbol})</span>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                <span className="uppercase">{preview.chain}</span>
                {preview.priceUsd != null && brlRate != null && (
                  <span>• {formatBRL(preview.priceUsd * brlRate)}</span>
                )}
                {preview.priceChange24h != null && (
                  <span className={preview.priceChange24h >= 0 ? "text-green-500" : "text-red-500"}>
                    {preview.priceChange24h >= 0 ? "+" : ""}{preview.priceChange24h.toFixed(2)}%
                  </span>
                )}
              </div>
            </div>
            <Button onClick={() => addToken.mutate()} disabled={addToken.isPending}>Adicionar</Button>
          </div>
        )}
      </div>


      <div className="rounded-xl border bg-card divide-y">
        {(tokens ?? []).map((t: any) => (
          <div key={t.id} className="p-3 flex items-center gap-2">
            <Input
              type="number" value={t.ordem} className="w-16"
              onChange={(e) => updateToken.mutate({ id: t.id, ordem: parseInt(e.target.value) || 0 })}
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-mono truncate">{t.contract_address}</div>
              <div className="text-xs text-muted-foreground">{t.chain}</div>
            </div>
            <Button
              size="sm" variant={t.ativo ? "default" : "outline"}
              onClick={() => updateToken.mutate({ id: t.id, ativo: !t.ativo })}
            >
              {t.ativo ? "Ativo" : "Inativo"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => confirm("Remover?") && deleteToken.mutate(t.id)}>
              <Trash2 size={16} />
            </Button>
          </div>
        ))}
        {(!tokens || tokens.length === 0) && (
          <div className="p-6 text-center text-sm text-muted-foreground">Nenhum token no ticker.</div>
        )}
      </div>
    </div>
  );
}

function SocialForm() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["social_links"],
    queryFn: async () => (await supabase.from("social_links").select("*").eq("id", 1).maybeSingle()).data,
  });
  const [x, setX] = useState(""); const [tg, setTg] = useState(""); const [wa, setWa] = useState(""); const [ig, setIg] = useState("");
  useEffect(() => {
    setX(data?.x_url ?? ""); setTg(data?.telegram_url ?? ""); setWa(data?.whatsapp_url ?? ""); setIg(data?.instagram_url ?? "");
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("social_links").upsert({
        id: 1, x_url: x || null, telegram_url: tg || null, whatsapp_url: wa || null, instagram_url: ig || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Redes atualizadas"); qc.invalidateQueries({ queryKey: ["social_links"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <Input placeholder="X (https://x.com/...)" value={x} onChange={(e) => setX(e.target.value)} />
      <Input placeholder="Telegram (https://t.me/...)" value={tg} onChange={(e) => setTg(e.target.value)} />
      <Input placeholder="WhatsApp (https://chat.whatsapp.com/...)" value={wa} onChange={(e) => setWa(e.target.value)} />
      <Input placeholder="Instagram (https://instagram.com/...)" value={ig} onChange={(e) => setIg(e.target.value)} />
      <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvar</Button>
    </div>
  );
}

function TeamAdmin() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["team_admin"],
    queryFn: async () => (await supabase.from("team_members").select("*").order("sort_order")).data ?? [],
  });
  const [name, setName] = useState(""); const [role, setRole] = useState("");
  const [x, setX] = useState(""); const [tg, setTg] = useState(""); const [avatar, setAvatar] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: async () => {
      if (!name.trim() || !role.trim()) throw new Error("Nome e função obrigatórios");
      const { error } = await supabase.from("team_members").insert({
        name: name.trim(), role: role.trim(),
        x_url: x || null, telegram_url: tg || null, avatar_url: avatar,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setName(""); setRole(""); setX(""); setTg(""); setAvatar(null);
      qc.invalidateQueries({ queryKey: ["team_admin"] });
      qc.invalidateQueries({ queryKey: ["team_members"] });
      toast.success("Membro adicionado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("team_members").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team_admin"] });
      qc.invalidateQueries({ queryKey: ["team_members"] });
    },
  });

  const update = useMutation({
    mutationFn: async (m: any) => { const { error } = await supabase.from("team_members").update({
      name: m.name, role: m.role, x_url: m.x_url, telegram_url: m.telegram_url, avatar_url: m.avatar_url,
    }).eq("id", m.id); if (error) throw error; },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team_admin"] });
      qc.invalidateQueries({ queryKey: ["team_members"] });
      toast.success("Salvo");
    },
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4 space-y-2">
        <h3 className="font-semibold">Adicionar membro</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Função" value={role} onChange={(e) => setRole(e.target.value)} />
          <Input placeholder="X (URL)" value={x} onChange={(e) => setX(e.target.value)} />
          <Input placeholder="Telegram (URL)" value={tg} onChange={(e) => setTg(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Input type="file" accept="image/*" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            setAvatar(await fileToResizedDataUrl(f, 256, 0.85));
          }} />
          {avatar && <img src={avatar} alt="" className="h-10 w-10 rounded-full object-cover border" />}
        </div>
        <Button onClick={() => add.mutate()} disabled={add.isPending}>Adicionar</Button>
      </div>

      <div className="space-y-2">
        {(data ?? []).map((m: any) => (
          <MemberEditor key={m.id} member={m} onSave={(p) => update.mutate(p)} onDelete={() => del.mutate(m.id)} />
        ))}
      </div>
    </div>
  );
}

function MemberEditor({ member, onSave, onDelete }: { member: any; onSave: (m: any) => void; onDelete: () => void }) {
  const [m, setM] = useState(member);
  useEffect(() => setM(member), [member]);
  return (
    <div className="rounded-lg border bg-card p-3 flex flex-col sm:flex-row gap-3 items-start">
      {m.avatar_url ? (
        <img src={m.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover border" />
      ) : (
        <div className="h-16 w-16 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">{(m.name ?? "?")[0]}</div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1 w-full">
        <Input value={m.name ?? ""} onChange={(e) => setM({ ...m, name: e.target.value })} placeholder="Nome" />
        <Input value={m.role ?? ""} onChange={(e) => setM({ ...m, role: e.target.value })} placeholder="Função" />
        <Input value={m.x_url ?? ""} onChange={(e) => setM({ ...m, x_url: e.target.value })} placeholder="X URL" />
        <Input value={m.telegram_url ?? ""} onChange={(e) => setM({ ...m, telegram_url: e.target.value })} placeholder="Telegram URL" />
        <Input type="file" accept="image/*" onChange={async (e) => {
          const f = e.target.files?.[0]; if (!f) return;
          setM({ ...m, avatar_url: await fileToResizedDataUrl(f, 256, 0.85) });
        }} className="sm:col-span-2" />
      </div>
      <div className="flex flex-col gap-2">
        <Button size="sm" onClick={() => onSave(m)}>Salvar</Button>
        <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 size={16} /></Button>
      </div>
    </div>
  );
}

function PostsAdmin() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["admin_posts"],
    queryFn: async () => (await supabase.from("posts").select("id, type, title, token_name, created_at, user_id").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("posts").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin_posts"] }); qc.invalidateQueries({ queryKey: ["feed"] }); toast.success("Removido"); },
  });
  return (
    <div className="rounded-xl border bg-card divide-y">
      {(data ?? []).map((p: any) => (
        <div key={p.id} className="p-3 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-sm truncate">
              <span className="text-primary uppercase text-xs mr-2">{p.type}</span>
              {p.token_name ?? p.title ?? p.id}
            </div>
            <div className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString("pt-BR")}</div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => confirm("Apagar?") && del.mutate(p.id)}><Trash2 size={16} /></Button>
        </div>
      ))}
      {(!data || data.length === 0) && <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma postagem.</div>}
    </div>
  );
}
