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
import { useI18n } from "@/lib/i18n";
import { Loader2, FileText, X } from "lucide-react";
import { detectLanguage } from "@/lib/translate";
import { safeHttpUrl } from "@/lib/safe-url";

const MAX_PDF_MB = 25;



export function NewPostForm() {
  const { user } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"text" | "token">("text");

  // text
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

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

  const uploadFile = async (): Promise<{ url: string; name: string } | null> => {
    if (!file || !user) return null;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("post-files").upload(path, file, {
        contentType: file.type || "application/pdf",
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage
        .from("post-files")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (sErr || !signed) throw sErr ?? new Error("Falha ao gerar link");
      return { url: signed.signedUrl, name: file.name };
    } finally {
      setUploading(false);
    }
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Entre para postar");
      if (file && file.size > MAX_PDF_MB * 1024 * 1024) throw new Error(`Arquivo maior que ${MAX_PDF_MB}MB`);
      const uploaded = await uploadFile();
      if (tab === "text") {
        if (!content.trim() && !uploaded) throw new Error("Escreva algo ou envie um arquivo");
        const body = content.trim();
        const lang = detectLanguage(body, "pt");
        const { error } = await supabase.from("posts").insert({
          user_id: user.id, type: "text",
          title: title.trim() || null,
          content: body,
          content_original: body,
          content_pt: lang === "pt" ? body : null,
          content_en: lang === "en" ? body : null,
          original_language: lang,
          image_url: image,
          file_url: uploaded?.url ?? null,
          file_name: uploaded?.name ?? null,
        } as any);
        if (error) throw error;
      } else {
        if (!fetched) throw new Error("Clique em Buscar para carregar as informações do token");
        if (!tName.trim() || !tSymbol.trim() || !tContract.trim()) throw new Error("Contrato inválido ou token não encontrado");
        if (!normalizeChain(tChain)) throw new Error("Rede não suportada pelo gráfico");
        const body = tContent.trim() || null;
        const lang = body ? detectLanguage(body, "pt") : "pt";
        const { error } = await supabase.from("posts").insert({
          user_id: user.id, type: "token",
          token_name: tName.trim(),
          token_symbol: tSymbol.trim().toUpperCase(),
          token_contract: tContract.trim(),
          token_chain: tChain,
          token_link: (() => {
            const raw = tLink.trim();
            if (!raw) return null;
            const safe = safeHttpUrl(raw);
            if (!safe) throw new Error("Link do projeto inválido — use uma URL http(s) completa");
            return safe;
          })(),
          image_url: tImage,
          content: body,
          content_original: body,
          content_pt: body && lang === "pt" ? body : null,
          content_en: body && lang === "en" ? body : null,
          original_language: lang,
          file_url: uploaded?.url ?? null,
          file_name: uploaded?.name ?? null,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Postado!");
      setTitle(""); setContent(""); setImage(null); setFile(null);
      setTName(""); setTSymbol(""); setTContract(""); setTLink(""); setTImage(null); setTContent(""); setFetched(false);
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) {
    return (
      <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
        <Link to="/auth" className="text-primary hover:underline">{t("post.new.signInCta")}</Link> {t("post.new.signInSuffix")}
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
          <TabsTrigger value="text">{t("post.new.tabText")}</TabsTrigger>
          <TabsTrigger value="token">{t("post.new.tabToken")}</TabsTrigger>
        </TabsList>

        <TabsContent value="text" className="space-y-2 mt-4">
          <Input placeholder={t("post.new.title")} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} />
          <Textarea placeholder={t("post.new.content")} value={content} onChange={(e) => setContent(e.target.value)} rows={4} maxLength={2000} />
          <div className="flex items-center gap-2">
            <Input type="file" accept="image/*" onChange={(e) => handleImg(e.target.files?.[0], setImage)} className="flex-1" />
            {image && <img src={image} alt="" className="h-12 w-12 rounded object-cover border" />}
          </div>
        </TabsContent>

        <TabsContent value="token" className="space-y-3 mt-4">
          <div>
            <label className="text-xs text-muted-foreground">Endereço do contrato</label>
            <div className="flex gap-2 mt-1">
              <Input
                placeholder="0x… ou endereço Solana"
                value={tContract}
                onChange={(e) => { setTContract(e.target.value); setFetched(false); }}
                className="font-mono text-xs flex-1"
              />
              <Button type="button" variant="secondary" onClick={doLookup} disabled={fetching || !tContract.trim()}>
                {fetching ? <><Loader2 size={14} className="animate-spin mr-1" /> Buscando…</> : "Buscar"}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Nome, símbolo, rede, imagem e preço são preenchidos automaticamente via DexScreener.
            </p>
          </div>

          {fetched && (
            <div className="rounded-lg border bg-muted/30 p-3 flex items-center gap-3">
              {tImage ? (
                <img src={tImage} alt="" className="h-12 w-12 rounded-full object-cover border" />
              ) : (
                <div className="h-12 w-12 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold">
                  {tSymbol[0] ?? "?"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{tName} <span className="text-primary">${tSymbol}</span></div>
                <div className="text-xs text-muted-foreground uppercase">{tChain}</div>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={resetToken}>Limpar</Button>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground">Site do projeto (manual)</label>
            <Input placeholder="https://…" value={tLink} onChange={(e) => setTLink(e.target.value)} className="mt-1" />
          </div>

          <Textarea placeholder="Descrição do projeto (opcional)" value={tContent} onChange={(e) => setTContent(e.target.value)} rows={3} maxLength={1000} />

          {!fetched && (
            <p className="text-xs text-muted-foreground">
              Clique em <strong>Buscar</strong> para carregar as informações do token antes de publicar.
            </p>
          )}
        </TabsContent>
      </Tabs>

      <div className="mt-4 space-y-2">
        <label className="text-xs text-muted-foreground">Anexar PDF (livro, whitepaper, etc.) — até {MAX_PDF_MB}MB</label>
        {file ? (
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
            <FileText size={16} className="text-primary shrink-0" />
            <span className="text-sm truncate flex-1">{file.name}</span>
            <span className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)}MB</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setFile(null)}>
              <X size={14} />
            </Button>
          </div>
        ) : (
          <Input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > MAX_PDF_MB * 1024 * 1024) { toast.error(`Arquivo maior que ${MAX_PDF_MB}MB`); return; }
              setFile(f);
            }}
          />
        )}
      </div>

      <div className="flex justify-end mt-4">
        <Button onClick={() => submit.mutate()} disabled={submit.isPending || uploading}>
          {uploading ? "…" : submit.isPending ? t("post.publishing") : t("post.publish")}
        </Button>
      </div>
    </div>
  );
}
