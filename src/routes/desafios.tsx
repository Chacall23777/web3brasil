import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus, Trophy, Users, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { lookupToken, isValidSolanaAddress } from "@/lib/spl-token-lookup";
import { createChallenge } from "@/lib/challenges.functions";

export const Route = createFileRoute("/desafios")({
  component: DesafiosPage,
  head: () => ({
    meta: [
      { title: "Desafios — WEB3BRASIL" },
      {
        name: "description",
        content:
          "Crie e participe de desafios com distribuição em massa de tokens Solana para vencedores validados.",
      },
      { property: "og:title", content: "Desafios — WEB3BRASIL" },
      {
        property: "og:description",
        content: "Campanhas de recompensas em cripto para múltiplos vencedores na Web3Brasil.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Challenge = {
  id: string;
  title: string;
  description: string;
  cover_url: string | null;
  token_symbol: string | null;
  token_decimals: number;
  total_amount: number;
  winners_count: number;
  amount_per_winner: number;
  status: string;
  starts_at: string;
  ends_at: string;
  escrow_wallet: string;
  creator_id: string;
};

const TEMPLATES = [
  { id: "follow_x_comment", label: "Seguir conta no X + comentar" },
  { id: "post_hashtag", label: "Postar no X com hashtag" },
  { id: "answer_question", label: "Responder uma pergunta" },
  { id: "custom", label: "Regra personalizada" },
] as const;

function statusBadge(s: string) {
  const map: Record<string, { label: string; cls: string }> = {
    awaiting_deposit: { label: "Aguardando depósito", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
    active: { label: "Ativo", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
    closed: { label: "Encerrado", cls: "bg-muted text-foreground/70" },
    distributing: { label: "Distribuindo", cls: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
    completed: { label: "Concluído", cls: "bg-primary/15 text-primary border-primary/30" },
    failed: { label: "Falha parcial", cls: "bg-destructive/15 text-destructive border-destructive/30" },
    cancelled: { label: "Cancelado", cls: "bg-muted text-muted-foreground" },
  };
  const m = map[s] ?? { label: s, cls: "bg-muted" };
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}

function DesafiosPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [openCreate, setOpenCreate] = useState(false);

  const { data: challenges, isLoading } = useQuery({
    queryKey: ["challenges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("challenges" as any)
        .select("*")
        .neq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as Challenge[];
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      <header className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/30 px-3 py-1 text-xs font-semibold text-primary">
            <Trophy className="h-3.5 w-3.5" /> Desafios com recompensa em massa
          </div>
          <h1 className="font-display text-3xl font-bold">Desafios</h1>
          <p className="text-muted-foreground text-sm max-w-2xl">
            Distribua tokens Solana para vários vencedores validados por regras sociais. Depósito
            fica em custódia até o encerramento.
          </p>
        </div>
        {user ? (
          <Button onClick={() => setOpenCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Criar desafio
          </Button>
        ) : (
          <Link to="/auth"><Button>Entrar para criar</Button></Link>
        )}
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando desafios…
        </div>
      ) : (challenges?.length ?? 0) === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          Nenhum desafio ainda. Seja o primeiro a criar!
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {challenges!.map((c) => (
            <Link
              key={c.id}
              to="/desafios/$id"
              params={{ id: c.id }}
              className="rounded-xl border bg-card hover:shadow-md transition overflow-hidden flex flex-col"
            >
              {c.cover_url ? (
                <img src={c.cover_url} alt="" className="h-32 w-full object-cover" />
              ) : (
                <div className="h-32 w-full bg-gradient-to-br from-primary/20 to-fuchsia-500/20 flex items-center justify-center">
                  <Trophy className="h-10 w-10 text-primary/60" />
                </div>
              )}
              <div className="p-4 space-y-2 flex-1 flex flex-col">
                <div className="flex items-center justify-between gap-2">
                  {statusBadge(c.status)}
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(c.ends_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <h3 className="font-semibold line-clamp-2">{c.title}</h3>
                <p className="text-xs text-muted-foreground line-clamp-2">{c.description}</p>
                <div className="mt-auto pt-2 flex items-center justify-between text-sm">
                  <span className="font-bold text-primary">
                    {c.total_amount.toLocaleString("pt-BR")} {c.token_symbol ?? "tokens"}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" /> {c.winners_count} vencedores
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {openCreate && (
        <CreateChallengeDialog
          onClose={() => setOpenCreate(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["challenges"] });
            setOpenCreate(false);
          }}
        />
      )}
    </div>
  );
}

function CreateChallengeDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const create = useServerFn(createChallenge);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [mint, setMint] = useState("");
  const [tokenMeta, setTokenMeta] = useState<{ decimals: number; symbol?: string; name?: string } | null>(null);
  const [checkingMint, setCheckingMint] = useState(false);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [winners, setWinners] = useState<number>(1);
  const [template, setTemplate] = useState<(typeof TEMPLATES)[number]["id"]>("follow_x_comment");
  const [xHandle, setXHandle] = useState("");
  const [hashtag, setHashtag] = useState("");
  const [question, setQuestion] = useState("");
  const [customRule, setCustomRule] = useState("");
  const [validationMode, setValidationMode] = useState<"manual" | "community">("manual");
  const [startsAt, setStartsAt] = useState(() => new Date(Date.now() + 5 * 60000).toISOString().slice(0, 16));
  const [endsAt, setEndsAt] = useState(() => new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 16));
  const [busy, setBusy] = useState(false);

  const perWinner = winners > 0 && totalAmount > 0 ? totalAmount / winners : 0;

  async function checkMint() {
    const t = mint.trim();
    if (!isValidSolanaAddress(t)) {
      toast.error("Endereço do token inválido. Verifique o mint.");
      return;
    }
    setCheckingMint(true);
    try {
      const info = await lookupToken(t);
      setTokenMeta({ decimals: info.decimals, symbol: info.symbol, name: info.name });
      toast.success(`Token: ${info.symbol ?? info.name ?? "SPL"} (${info.decimals} decimais)`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCheckingMint(false);
    }
  }

  async function submit() {
    if (!tokenMeta) return toast.error("Verifique o token antes de criar.");
    if (title.trim().length < 3) return toast.error("Título muito curto.");
    if (description.trim().length < 10) return toast.error("Descrição muito curta.");
    if (totalAmount <= 0 || winners <= 0) return toast.error("Total e nº de vencedores obrigatórios.");
    if (new Date(endsAt) <= new Date(startsAt)) return toast.error("Data de término deve ser posterior ao início.");

    const rules_json: Record<string, string> = {};
    if (template === "follow_x_comment") rules_json.x_handle = xHandle.replace(/^@/, "").trim();
    if (template === "post_hashtag") rules_json.hashtag = hashtag.replace(/^#/, "").trim();
    if (template === "answer_question") rules_json.question = question.trim();
    if (template === "custom") rules_json.custom_md = customRule.trim();

    setBusy(true);
    try {
      const res = await create({
        data: {
          title: title.trim(),
          description: description.trim(),
          cover_url: coverUrl.trim() || null,
          token_mint: mint.trim(),
          token_symbol: tokenMeta.symbol ?? null,
          token_name: tokenMeta.name ?? null,
          token_decimals: tokenMeta.decimals,
          total_amount: totalAmount,
          winners_count: winners,
          rules_template: template,
          rules_json,
          validation_mode: validationMode,
          starts_at: new Date(startsAt).toISOString(),
          ends_at: new Date(endsAt).toISOString(),
        },
      });
      toast.success("Desafio criado! Envie o depósito para ativar.");
      onCreated(res.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar desafio</DialogTitle>
          <DialogDescription>
            Configure o desafio, deposite os tokens na wallet de custódia e a distribuição roda ao término.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={5000} />
          </div>
          <div>
            <Label>URL da imagem de capa (opcional)</Label>
            <Input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://…" />
          </div>

          <div className="rounded-lg border p-3 space-y-2">
            <Label>Token (mint Solana)</Label>
            <div className="flex gap-2">
              <Input value={mint} onChange={(e) => { setMint(e.target.value); setTokenMeta(null); }} placeholder="Mint address" />
              <Button type="button" variant="outline" onClick={checkMint} disabled={checkingMint}>
                {checkingMint ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verificar"}
              </Button>
            </div>
            {tokenMeta && (
              <p className="text-xs text-muted-foreground">
                {tokenMeta.name ?? "SPL"} {tokenMeta.symbol ? `(${tokenMeta.symbol})` : ""} · {tokenMeta.decimals} decimais
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Total de tokens</Label>
              <Input type="number" min={0} value={totalAmount || ""} onChange={(e) => setTotalAmount(Number(e.target.value))} />
            </div>
            <div>
              <Label>Nº de vencedores</Label>
              <Input type="number" min={1} max={10000} value={winners} onChange={(e) => setWinners(Number(e.target.value))} />
            </div>
          </div>
          <div className="rounded bg-muted/50 px-3 py-2 text-sm">
            Valor por vencedor: <strong>{perWinner.toLocaleString("pt-BR", { maximumFractionDigits: 6 })}</strong>{" "}
            {tokenMeta?.symbol ?? "tokens"}
          </div>

          <div>
            <Label>Regra</Label>
            <select
              className="w-full h-9 rounded-md border bg-background px-2 text-sm"
              value={template}
              onChange={(e) => setTemplate(e.target.value as any)}
            >
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
          {template === "follow_x_comment" && (
            <div>
              <Label>Handle do X para seguir (sem @)</Label>
              <Input value={xHandle} onChange={(e) => setXHandle(e.target.value)} placeholder="web3brasil" />
            </div>
          )}
          {template === "post_hashtag" && (
            <div>
              <Label>Hashtag obrigatória</Label>
              <Input value={hashtag} onChange={(e) => setHashtag(e.target.value)} placeholder="Web3Brasil" />
            </div>
          )}
          {template === "answer_question" && (
            <div>
              <Label>Pergunta a ser respondida</Label>
              <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={2} />
            </div>
          )}
          {template === "custom" && (
            <div>
              <Label>Instruções personalizadas</Label>
              <Textarea value={customRule} onChange={(e) => setCustomRule(e.target.value)} rows={3} />
            </div>
          )}

          <div>
            <Label>Modo de validação</Label>
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => setValidationMode("manual")}
                className={`px-3 py-1.5 rounded border text-sm ${validationMode === "manual" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                Manual (criador/admin)
              </button>
              <button
                type="button"
                onClick={() => setValidationMode("community")}
                className={`px-3 py-1.5 rounded border text-sm ${validationMode === "community" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                Comunitária (votação)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início</Label>
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div>
              <Label>Término</Label>
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy || !tokenMeta}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar desafio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
