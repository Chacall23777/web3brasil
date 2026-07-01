import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { fileToResizedDataUrl } from "@/lib/image";
import { toast } from "sonner";
import { normalizeChain } from "./TokenChart";
import { lookupToken } from "@/lib/token-lookup";
import { Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

const CHAINS = ["solana", "ethereum", "bsc", "polygon", "base", "arbitrum", "optimism", "avalanche"];

export function NewPostForm() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"text" | "token">("text");

  // text
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [image, setImage] = useState<string | null>(null);

  // token
  const [tName, setTName] = useState("");
  const [tSymbol, setTSymbol] = useState("");
  const [tContract, setTContract] = useState("");
  const [tChain, setTChain] = useState("solana");
  const [tLink, setTLink] = useState("");
  const [tImage, setTImage] = useState<string | null>(null);
  const [tContent, setTContent] = useState("");
  const [fetched, setFetched] = useState(false);
  const [fetching, setFetching] = useState(false);

  const doLookup = async () => {
    if (!tContract.trim()) { toast.error("Informe o contrato"); return; }
    setFetching(true);
    try {
      const info = await lookupToken(tContract);
      if (!info) { toast.error("Token não encontrado no DexScreener"); return; }
      setTName(info.name || "");
      setTSymbol(info.symbol || "");
      setTChain(info.chain);
      if (info.image) setTImage(info.image);
      setFetched(true);
      toast.success(`Encontrado: ${info.name} ($${info.symbol})`);
    } catch {
      toast.error("Falha ao buscar o token");
    } finally {
      setFetching(false);
    }
  };

  const resetToken = () => {
    setFetched(false);
    setTName(""); setTSymbol(""); setTChain("solana"); setTImage(null);
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Entre para postar");
      if (tab === "text") {
        if (!content.trim()) throw new Error("Escreva algo");
        const { error } = await supabase.from("posts").insert({
          user_id: user.id, type: "text",
          title: title.trim() || null,
          content: content.trim(),
          image_url: image,
        });
        if (error) throw error;
      } else {
        if (!tName.trim() || !tSymbol.trim() || !tContract.trim()) throw new Error("Nome, símbolo e contrato são obrigatórios");
        if (!normalizeChain(tChain)) throw new Error("Rede não suportada pelo gráfico");
        const { error } = await supabase.from("posts").insert({
          user_id: user.id, type: "token",
          token_name: tName.trim(),
          token_symbol: tSymbol.trim().toUpperCase(),
          token_contract: tContract.trim(),
          token_chain: tChain,
          token_link: tLink.trim() || null,
          image_url: tImage,
          content: tContent.trim() || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Postado!");
      setTitle(""); setContent(""); setImage(null);
      setTName(""); setTSymbol(""); setTContract(""); setTLink(""); setTImage(null); setTContent("");
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
        <Link to="/auth" className="text-primary hover:underline">Entre com Google</Link> para postar na comunidade.
      </div>
    );
  }

  const handleImg = async (f: File | undefined, set: (v: string | null) => void) => {
    if (!f) return;
    try {
      const url = await fileToResizedDataUrl(f);
      set(url);
    } catch {
      toast.error("Não deu para processar a imagem");
    }
  };

  return (
    <div className="rounded-xl border bg-card p-4">
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="text">Postagem</TabsTrigger>
          <TabsTrigger value="token">Postar Token</TabsTrigger>
        </TabsList>

        <TabsContent value="text" className="space-y-2 mt-4">
          <Input placeholder="Título (opcional)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} />
          <Textarea placeholder="O que você quer compartilhar?" value={content} onChange={(e) => setContent(e.target.value)} rows={4} maxLength={2000} />
          <div className="flex items-center gap-2">
            <Input type="file" accept="image/*" onChange={(e) => handleImg(e.target.files?.[0], setImage)} className="flex-1" />
            {image && <img src={image} alt="" className="h-12 w-12 rounded object-cover border" />}
          </div>
        </TabsContent>

        <TabsContent value="token" className="space-y-2 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input placeholder="Nome do token" value={tName} onChange={(e) => setTName(e.target.value)} maxLength={80} />
            <Input placeholder="Símbolo / ticker" value={tSymbol} onChange={(e) => setTSymbol(e.target.value)} maxLength={20} />
          </div>
          <Input placeholder="Endereço do contrato" value={tContract} onChange={(e) => setTContract(e.target.value)} className="font-mono text-xs" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select value={tChain} onChange={(e) => setTChain(e.target.value)} className="h-9 rounded-md border bg-transparent px-3 text-sm">
              {CHAINS.map((c) => <option key={c} value={c} className="bg-background">{c}</option>)}
            </select>
            <Input placeholder="Link externo (site / X / TG)" value={tLink} onChange={(e) => setTLink(e.target.value)} />
          </div>
          <Textarea placeholder="Descrição do projeto (opcional)" value={tContent} onChange={(e) => setTContent(e.target.value)} rows={3} maxLength={1000} />
          <div className="flex items-center gap-2">
            <Input type="file" accept="image/*" onChange={(e) => handleImg(e.target.files?.[0], setTImage)} className="flex-1" />
            {tImage && <img src={tImage} alt="" className="h-12 w-12 rounded object-cover border" />}
          </div>
          <p className="text-xs text-muted-foreground">Gráfico será carregado pelo GeckoTerminal com base no contrato + rede.</p>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end mt-4">
        <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
          {submit.isPending ? "Publicando…" : "Publicar"}
        </Button>
      </div>
    </div>
  );
}
