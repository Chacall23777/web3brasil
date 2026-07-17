import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Loader2,
  Play,
  RotateCcw,
  Send,
  Trophy,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  verifyChallengeDeposit,
  submitParticipation,
  validateParticipation,
  distributeRewards,
  retryFailedDistributions,
} from "@/lib/challenges.functions";

export const Route = createFileRoute("/desafios/$id")({
  component: ChallengeDetail,
  head: ({ params }) => ({
    meta: [
      { title: `Desafio — WEB3BRASIL` },
      { name: "description", content: "Detalhes e participação em um desafio Web3Brasil." },
      { property: "og:type", content: "article" },
    ],
  }),
});

type Challenge = {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  cover_url: string | null;
  token_mint: string;
  token_symbol: string | null;
  token_decimals: number;
  total_amount: number;
  winners_count: number;
  amount_per_winner: number;
  rules_template: string;
  rules_json: Record<string, string>;
  validation_mode: string;
  starts_at: string;
  ends_at: string;
  escrow_wallet: string;
  status: string;
};

function ChallengeDetail() {
  const { id } = useParams({ from: "/desafios/$id" });
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: c, isLoading } = useQuery({
    queryKey: ["challenge", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("challenges" as any).select("*").eq("id", id).single();
      if (error) throw error;
      return data as unknown as Challenge;
    },
  });

  const { data: publicParts } = useQuery({
    queryKey: ["challenge-public-parts", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("challenge_participants_public" as any)
        .select("*")
        .eq("challenge_id", id);
      return (data ?? []) as any[];
    },
  });

  const isCreator = c && user && c.creator_id === user.id;

  const { data: adminParts } = useQuery({
    queryKey: ["challenge-admin-parts", id, isCreator],
    enabled: !!isCreator,
    queryFn: async () => {
      const { data } = await supabase
        .from("challenge_participants" as any)
        .select("*")
        .eq("challenge_id", id)
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  const { data: dists } = useQuery({
    queryKey: ["challenge-dists", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("challenge_distributions" as any)
        .select("*")
        .eq("challenge_id", id)
        .order("created_at", { ascending: false });
      return (data ?? []) as any[];
    },
  });

  if (isLoading) return <div className="mx-auto max-w-3xl px-4 py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!c) return <div className="mx-auto max-w-3xl px-4 py-10">Desafio não encontrado.</div>;

  const totalValid = (publicParts ?? []).filter((p: any) => p.status === "valid").length;
  const totalPending = (publicParts ?? []).filter((p: any) => p.status === "pending").length;
  const ended = new Date(c.ends_at).getTime() < Date.now();

  const rules = c.rules_json ?? {};
  let ruleText = "";
  if (c.rules_template === "follow_x_comment") ruleText = `Siga @${rules.x_handle} no X e comente com o link da sua resposta.`;
  else if (c.rules_template === "post_hashtag") ruleText = `Poste no X usando #${rules.hashtag}.`;
  else if (c.rules_template === "answer_question") ruleText = `Pergunta: ${rules.question}`;
  else ruleText = rules.custom_md ?? "Regra personalizada.";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">
      <Link to="/desafios" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Voltar
      </Link>

      {c.cover_url && <img src={c.cover_url} alt="" className="rounded-xl w-full max-h-72 object-cover" />}

      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={c.status} />
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> encerra {new Date(c.ends_at).toLocaleString("pt-BR")}
          </span>
        </div>
        <h1 className="font-display text-2xl font-bold">{c.title}</h1>
        <p className="text-sm whitespace-pre-wrap">{c.description}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Prêmio total" value={`${c.total_amount.toLocaleString("pt-BR")} ${c.token_symbol ?? ""}`} />
        <Stat label="Vencedores" value={c.winners_count.toString()} icon={<Users className="h-4 w-4" />} />
        <Stat
          label="Por vencedor"
          value={`${Number(c.amount_per_winner).toLocaleString("pt-BR", { maximumFractionDigits: 6 })} ${c.token_symbol ?? ""}`}
          icon={<Trophy className="h-4 w-4" />}
        />
        <Stat label="Participações" value={`${totalValid} válidas / ${totalPending} pendentes`} />
      </div>

      <section className="rounded-lg border p-4 space-y-2">
        <h2 className="font-semibold">Regras</h2>
        <p className="text-sm">{ruleText}</p>
        <p className="text-xs text-muted-foreground">
          Validação: <strong>{c.validation_mode === "manual" ? "manual (criador/admin)" : "comunitária"}</strong>
        </p>
      </section>

      {isCreator && c.status === "awaiting_deposit" && <DepositPanel challenge={c} />}

      {c.status === "active" && !ended && user && !isCreator && <ParticipateForm challengeId={c.id} />}
      {c.status === "active" && !ended && !user && (
        <div className="rounded-lg border p-4 text-sm">
          <Link to="/auth" className="underline">Entre</Link> para participar.
        </div>
      )}

      {isCreator && (adminParts?.length ?? 0) > 0 && (
        <AdminParticipantsPanel parts={adminParts!} onChange={() => qc.invalidateQueries({ queryKey: ["challenge-admin-parts", id] })} />
      )}

      {isCreator && ended && ["active", "closed", "failed"].includes(c.status) && (
        <DistributePanel
          challengeId={c.id}
          hasFailed={(dists ?? []).some((d: any) => d.status === "failed")}
          status={c.status}
          onDone={() => {
            qc.invalidateQueries({ queryKey: ["challenge", id] });
            qc.invalidateQueries({ queryKey: ["challenge-dists", id] });
          }}
        />
      )}

      {(dists?.length ?? 0) > 0 && (
        <section className="rounded-lg border p-4 space-y-2">
          <h2 className="font-semibold">Distribuições</h2>
          <div className="max-h-72 overflow-y-auto divide-y">
            {dists!.map((d: any) => (
              <div key={d.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                <code className="truncate">{d.wallet.slice(0, 8)}…{d.wallet.slice(-6)}</code>
                <span>{Number(d.amount).toLocaleString("pt-BR", { maximumFractionDigits: 6 })} {c.token_symbol ?? ""}</span>
                <DistStatus status={d.status} error={d.error} sig={d.tx_signature} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    awaiting_deposit: "bg-amber-500/15 text-amber-600 border-amber-500/30",
    active: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
    closed: "bg-muted",
    distributing: "bg-blue-500/15 text-blue-600 border-blue-500/30",
    completed: "bg-primary/15 text-primary border-primary/30",
    failed: "bg-destructive/15 text-destructive border-destructive/30",
    cancelled: "bg-muted",
  };
  return <Badge variant="outline" className={map[status] ?? ""}>{status}</Badge>;
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-3 space-y-1">
      <div className="text-[10px] uppercase text-muted-foreground flex items-center gap-1">{icon}{label}</div>
      <div className="text-sm font-semibold truncate">{value}</div>
    </div>
  );
}

function DistStatus({ status, error, sig }: { status: string; error: string | null; sig: string | null }) {
  if (status === "success") {
    return (
      <a
        href={sig ? `https://solscan.io/tx/${sig}` : "#"}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-emerald-600"
      >
        <Check className="h-3 w-3" /> ok
      </a>
    );
  }
  if (status === "failed") {
    return <span className="text-destructive" title={error ?? ""}>falha</span>;
  }
  return <span className="text-muted-foreground">pendente</span>;
}

function DepositPanel({ challenge }: { challenge: Challenge }) {
  const verify = useServerFn(verifyChallengeDeposit);
  const [sig, setSig] = useState("");
  const [busy, setBusy] = useState(false);

  async function check() {
    setBusy(true);
    try {
      const r = await verify({ data: { challenge_id: challenge.id, signature: sig.trim() || undefined } });
      if ((r as any).ok) {
        toast.success("Depósito verificado! Desafio ativo.");
        location.reload();
      } else {
        const rr = r as any;
        toast.error(
          `Faltam ${rr.missing.toLocaleString("pt-BR")} ${challenge.token_symbol ?? "tokens"} (recebidos ${rr.current.toLocaleString("pt-BR")} de ${rr.required.toLocaleString("pt-BR")}).`,
        );
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
      <h2 className="font-semibold flex items-center gap-2"><Wallet className="h-4 w-4" /> Depósito de custódia</h2>
      <p className="text-sm">
        Envie <strong>{challenge.total_amount.toLocaleString("pt-BR")} {challenge.token_symbol ?? ""}</strong> (mesmo mint)
        para a wallet abaixo:
      </p>
      <div className="flex items-center gap-2 bg-background rounded border px-2 py-1.5">
        <code className="text-xs truncate flex-1">{challenge.escrow_wallet}</code>
        <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(challenge.escrow_wallet); toast.success("Copiado."); }}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div>
        <Label className="text-xs">Assinatura da tx (opcional)</Label>
        <Input value={sig} onChange={(e) => setSig(e.target.value)} placeholder="tx signature" />
      </div>
      <Button onClick={check} disabled={busy} className="gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Verificar depósito
      </Button>
      <p className="text-xs text-muted-foreground">
        Vamos ler o saldo on-chain da wallet de custódia. Se estiver &gt;= ao total, o desafio fica ativo.
      </p>
    </section>
  );
}

function ParticipateForm({ challengeId }: { challengeId: string }) {
  const submit = useServerFn(submitParticipation);
  const { profile } = useAuth();
  const [wallet, setWallet] = useState(profile?.solana_wallet ?? "");
  const [proof, setProof] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    if (wallet.trim().length < 30) return toast.error("Informe uma wallet Solana válida.");
    if (!proof.trim()) return toast.error("Cole o link da sua prova (post no X).");
    setBusy(true);
    try {
      await submit({ data: { challenge_id: challengeId, wallet: wallet.trim(), proof_url: proof.trim() } });
      toast.success("Participação registrada! Aguarde validação.");
      setProof("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border p-4 space-y-3">
      <h2 className="font-semibold">Participar</h2>
      <div>
        <Label className="text-xs">Sua wallet Solana</Label>
        <Input value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="endereço para receber prêmio" />
      </div>
      <div>
        <Label className="text-xs">Link da prova (post no X)</Label>
        <Input value={proof} onChange={(e) => setProof(e.target.value)} placeholder="https://x.com/…" />
      </div>
      <Button onClick={send} disabled={busy} className="gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar participação
      </Button>
    </section>
  );
}

function AdminParticipantsPanel({ parts, onChange }: { parts: any[]; onChange: () => void }) {
  const validate = useServerFn(validateParticipation);
  const [busy, setBusy] = useState<string | null>(null);

  async function decide(id: string, decision: "valid" | "invalid") {
    setBusy(id);
    try {
      await validate({ data: { participant_id: id, decision } });
      toast.success("Atualizado.");
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-lg border p-4 space-y-2">
      <h2 className="font-semibold">Participações ({parts.length})</h2>
      <div className="max-h-96 overflow-y-auto divide-y">
        {parts.map((p) => (
          <div key={p.id} className="py-2 flex items-center justify-between gap-2 text-xs">
            <div className="flex-1 min-w-0">
              <a href={p.proof_url} target="_blank" rel="noreferrer" className="underline truncate block">{p.proof_url}</a>
              <code className="text-muted-foreground">{p.wallet.slice(0, 8)}…{p.wallet.slice(-6)}</code>
            </div>
            <Badge variant="outline" className={
              p.status === "valid" ? "bg-emerald-500/15 text-emerald-600" :
              p.status === "invalid" ? "bg-destructive/15 text-destructive" : "bg-muted"
            }>{p.status}</Badge>
            {p.status === "pending" && (
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => decide(p.id, "valid")} disabled={busy === p.id}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => decide(p.id, "invalid")} disabled={busy === p.id}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function DistributePanel({
  challengeId,
  hasFailed,
  status,
  onDone,
}: {
  challengeId: string;
  hasFailed: boolean;
  status: string;
  onDone: () => void;
}) {
  const distribute = useServerFn(distributeRewards);
  const retry = useServerFn(retryFailedDistributions);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!confirm("Distribuir recompensas agora? Essa ação envia tokens on-chain.")) return;
    setBusy(true);
    try {
      const r = await distribute({ data: { challenge_id: challengeId } });
      toast.success(`Distribuição finalizada: ${(r as any).success} ok, ${(r as any).failed} falhas.`);
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function retryFailed() {
    setBusy(true);
    try {
      const r = await retry({ data: { challenge_id: challengeId } });
      toast.success(`Retentativa: ${(r as any).success} ok, ${(r as any).failed} falhas.`);
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-blue-500/40 bg-blue-500/5 p-4 space-y-2">
      <h2 className="font-semibold">Distribuição</h2>
      <p className="text-sm">
        O desafio encerrou. Distribua as recompensas para os vencedores validados.
      </p>
      <div className="flex gap-2 flex-wrap">
        {status !== "completed" && (
          <Button onClick={run} disabled={busy} className="gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Distribuir agora
          </Button>
        )}
        {hasFailed && (
          <Button variant="outline" onClick={retryFailed} disabled={busy} className="gap-2">
            <RotateCcw className="h-4 w-4" /> Reenviar falhas
          </Button>
        )}
      </div>
    </section>
  );
}
