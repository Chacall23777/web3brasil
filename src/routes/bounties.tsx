import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Coins,
  Flame,
  Loader2,
  Plus,
  ShieldCheck,
  Wallet,
  X,
  Check,
  RotateCcw,
  Link2,
  Trash2,
} from "lucide-react";
import { linkifyText } from "@/lib/linkify";
import { ShareButtons } from "@/components/ShareButtons";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { lookupToken, isValidSolanaAddress } from "@/lib/spl-token-lookup";
import {
  createBounty,
  confirmBountyDeposit,
  submitBountyProof,
  reviewBountySubmission,
  refundBounty,
} from "@/lib/bounties.functions";

export const Route = createFileRoute("/bounties")({
  component: BountiesPage,
  head: () => ({
    meta: [
      { title: "Bounties — WEB3BRASIL" },
      {
        name: "description",
        content:
          "Pague ou seja pago em cripto por qualquer tarefa, direto na comunidade WEB3BRASIL.",
      },
    ],
  }),
});

type Bounty = {
  id: string;
  creator_id: string;
  title: string;
  description: string;
  token_mint: string;
  token_symbol: string | null;
  token_name: string | null;
  token_decimals: number;
  reward_amount: number;
  vault_address: string;
  status: string;
  deadline: string | null;
  stream_url: string | null;
  created_at: string;
};

type Submission = {
  id: string;
  bounty_id: string;
  submitter_id: string;
  submitter_wallet: string;
  proof_url: string;
  note: string | null;
  status: string;
  payout_tx_signature: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  awaiting_deposit: "Aguardando depósito",
  open: "Aberta",
  under_review: "Em revisão",
  completed: "Concluída",
  refunded: "Reembolsada",
  cancelled: "Cancelada",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  awaiting_deposit: "outline",
  open: "default",
  under_review: "secondary",
  completed: "secondary",
  refunded: "outline",
  cancelled: "destructive",
};

function BountiesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Bounty | null>(null);

  const { data: bounties, isLoading } = useQuery({
    queryKey: ["bounties_all"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("bounties")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(60);
      return (data ?? []) as Bounty[];
    },
    refetchInterval: 20_000,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["bounties_all"] });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      <section className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-transparent to-transparent p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
              <Flame className="h-3.5 w-3.5" />
              Bounties
            </div>
            <h1 className="mt-3 font-display text-3xl font-bold">Pague ou seja pago em cripto</h1>
            <p className="mt-1.5 max-w-xl text-muted-foreground">
              Trave a recompensa em qualquer token SPL, publique a tarefa, e pague quem entregar a
              melhor prova. O cofre de cada bounty é uma carteira dedicada — só o backend movimenta
              os fundos, e só quando você aprova.
            </p>
          </div>
          {user ? (
            <Button size="lg" className="font-bold" onClick={() => setCreateOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Criar bounty
            </Button>
          ) : (
            <Link to="/auth">
              <Button size="lg" className="font-bold">
                Entrar para criar
              </Button>
            </Link>
          )}
        </div>
      </section>

      {isLoading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (bounties ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          Nenhuma bounty ainda. Seja o primeiro a criar uma.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(bounties ?? []).map((b) => (
            <button
              key={b.id}
              onClick={() => setSelected(b)}
              className="text-left rounded-xl border bg-card p-4 transition hover:border-primary/60"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 font-display font-bold text-lg text-primary">
                  <Coins className="h-4 w-4" />
                  {b.reward_amount.toLocaleString("pt-BR")} {b.token_symbol ?? ""}
                </div>
                <Badge variant={STATUS_VARIANT[b.status] ?? "outline"}>
                  {STATUS_LABEL[b.status] ?? b.status}
                </Badge>
              </div>
              <div className="mt-1.5 font-medium">{b.title}</div>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{b.description}</p>
            </button>
          ))}
        </div>
      )}

      <CreateBountyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          refresh();
        }}
      />

      {selected && (
        <BountyDetailDialog
          bounty={selected}
          onOpenChange={(o) => !o && setSelected(null)}
          onChanged={(updated) => {
            refresh();
            setSelected(updated);
          }}
        />
      )}
    </div>
  );
}

function CreateBountyDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const createBountyFn = useServerFn(createBounty);
  const [step, setStep] = useState<"form" | "deposit">("form");
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tokenMint, setTokenMint] = useState("");
  const [tokenInfo, setTokenInfo] = useState<{
    symbol: string | null;
    name: string | null;
    decimals: number;
  } | null>(null);
  const [rewardAmount, setRewardAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [taskLinks, setTaskLinks] = useState<{ label: string; url: string }[]>([]);
  const [result, setResult] = useState<{ id: string; vault_address: string } | null>(null);
  const [txSig, setTxSig] = useState("");
  const confirmDepositFn = useServerFn(confirmBountyDeposit);

  const reset = () => {
    setStep("form");
    setTitle("");
    setDescription("");
    setTokenMint("");
    setTokenInfo(null);
    setRewardAmount("");
    setDeadline("");
    setTaskLinks([]);
    setResult(null);
    setTxSig("");
  };

  const checkToken = async () => {
    const trimmed = tokenMint.trim();
    if (!trimmed) {
      toast.error("Informe o endereço do mint do token.");
      return;
    }
    if (!isValidSolanaAddress(trimmed)) {
      toast.error("Endereço de mint inválido. Use um endereço Solana base58 válido (32–44 caracteres).");
      setTokenInfo(null);
      return;
    }
    try {
      const info = await lookupToken(trimmed);
      setTokenInfo({ symbol: info.symbol ?? null, name: info.name ?? null, decimals: info.decimals });
      toast.success(`Token encontrado: ${info.symbol ?? info.name ?? "OK"}`);
    } catch (e: any) {
      setTokenInfo(null);
      toast.error(e?.message ?? "Não foi possível ler o token.");
    }
  };

  const submit = async () => {
    if (!tokenInfo) {
      toast.error("Verifique o token antes de continuar.");
      return;
    }
    const amount = Number(rewardAmount);
    if (!amount || amount <= 0) {
      toast.error("Informe uma recompensa válida.");
      return;
    }
    setBusy(true);
    try {
      const validLinks = taskLinks
        .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
        .filter((l) => l.url);
      for (const l of validLinks) {
        try {
          const u = new URL(l.url);
          if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
        } catch {
          toast.error(`Link inválido: ${l.url}`);
          setBusy(false);
          return;
        }
      }
      const linksBlock = validLinks.length
        ? "\n\n🔗 Links da tarefa:\n" +
          validLinks.map((l) => (l.label ? `• ${l.label}: ${l.url}` : `• ${l.url}`)).join("\n")
        : "";
      const r = await createBountyFn({
        data: {
          title,
          description: description + linksBlock,
          token_mint: tokenMint.trim(),
          token_symbol: tokenInfo.symbol,
          token_name: tokenInfo.name,
          token_decimals: tokenInfo.decimals,
          reward_amount: amount,
          deadline: deadline ? new Date(deadline).toISOString() : null,
          stream_url: null,
        },
      });
      setResult(r);
      setStep("deposit");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao criar bounty.");
    } finally {
      setBusy(false);
    }
  };

  const confirmDeposit = async () => {
    if (!result) return;
    setBusy(true);
    try {
      await confirmDepositFn({
        data: { bounty_id: result.id, signature: txSig.trim() || undefined },
      });
      toast.success("Depósito confirmado — bounty publicada!");
      onCreated();
      onOpenChange(false);
      reset();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível confirmar o depósito.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-lg">
        {step === "form" ? (
          <>
            <DialogHeader>
              <DialogTitle>Criar bounty</DialogTitle>
              <DialogDescription>
                A recompensa fica travada num cofre exclusivo dessa bounty até você aprovar uma
                entrega ou cancelar.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label>Título</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={140}
                  placeholder="Ex: Crie um vídeo curto sobre o projeto"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Descrição / entregáveis</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={4000}
                  rows={4}
                  placeholder="O que precisa ser entregue, formato, prazo etc."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Token do pagamento (endereço do mint na Solana)</Label>
                <div className="flex gap-2">
                  <Input
                    value={tokenMint}
                    onChange={(e) => {
                      setTokenMint(e.target.value);
                      setTokenInfo(null);
                    }}
                    placeholder="Ex: EPjFW...t1v"
                  />
                  <Button type="button" variant="outline" onClick={checkToken}>
                    Verificar
                  </Button>
                </div>
                {tokenInfo && (
                  <p className="text-xs text-primary">
                    ✓ {tokenInfo.name ?? "Token"} ({tokenInfo.symbol ?? "?"}) · {tokenInfo.decimals}{" "}
                    decimais
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Recompensa</Label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={rewardAmount}
                    onChange={(e) => setRewardAmount(e.target.value)}
                    placeholder="0.0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Prazo (opcional)</Label>
                  <Input
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5" /> Links da tarefa (opcional)
                  </Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setTaskLinks((prev) => [...prev, { label: "", url: "" }])
                    }
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar link
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ex: perfil no X para seguir, post para curtir/repostar, tweet a responder.
                </p>
                {taskLinks.map((l, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      placeholder="Rótulo (ex: Seguir no X)"
                      value={l.label}
                      onChange={(e) =>
                        setTaskLinks((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                        )
                      }
                      className="w-1/3"
                    />
                    <Input
                      placeholder="https://..."
                      value={l.url}
                      onChange={(e) =>
                        setTaskLinks((prev) =>
                          prev.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)),
                        )
                      }
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        setTaskLinks((prev) => prev.filter((_, j) => j !== i))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button disabled={busy || !title || !description || !tokenInfo} onClick={submit}>
                {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Gerar cofre da bounty
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Deposite a recompensa</DialogTitle>
              <DialogDescription>
                Envie exatamente {rewardAmount} {tokenInfo?.symbol} para o endereço abaixo, a partir
                da sua carteira (Phantom, Solflare etc). Depois clique em verificar — vamos ler o
                saldo real do cofre na Solana.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="rounded-lg border bg-muted p-3">
                <div className="text-xs text-muted-foreground mb-1">Endereço do cofre</div>
                <div className="font-mono text-sm break-all">{result?.vault_address}</div>
              </div>
              <div className="space-y-1.5">
                <Label>Assinatura da transação (opcional)</Label>
                <Input
                  value={txSig}
                  onChange={(e) => setTxSig(e.target.value)}
                  placeholder="Pode colar a signature ou deixar em branco"
                />
              </div>
            </div>
            <DialogFooter>
              <Button disabled={busy} onClick={confirmDeposit}>
                {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                Verificar depósito e publicar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BountyDetailDialog({
  bounty,
  onOpenChange,
  onChanged,
}: {
  bounty: Bounty;
  onOpenChange: (o: boolean) => void;
  onChanged: (b: Bounty) => void;
}) {
  const { user, profile } = useAuth();
  const isCreator = user?.id === bounty.creator_id;
  const submitProofFn = useServerFn(submitBountyProof);
  const reviewFn = useServerFn(reviewBountySubmission);
  const refundFn = useServerFn(refundBounty);
  const confirmDepositFn = useServerFn(confirmBountyDeposit);
  const [proofUrl, setProofUrl] = useState("");
  const [note, setNote] = useState("");
  const [wallet, setWallet] = useState(profile?.solana_wallet ?? "");
  const [depositSig, setDepositSig] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: submissions, refetch } = useQuery({
    queryKey: ["bounty_submissions", bounty.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("bounty_submissions_public")
        .select("*")
        .eq("bounty_id", bounty.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as Submission[];
    },
  });

  const doSubmit = async () => {
    if (!proofUrl.trim() || !wallet.trim()) {
      toast.error("Informe o link da prova e sua carteira Solana.");
      return;
    }
    setBusy(true);
    try {
      await submitProofFn({
        data: {
          bounty_id: bounty.id,
          submitter_wallet: wallet.trim(),
          proof_url: proofUrl.trim(),
          note: note.trim() || null,
        },
      });
      toast.success("Prova enviada! Aguarde a revisão do criador.");
      setProofUrl("");
      setNote("");
      refetch();
      onChanged({ ...bounty, status: "under_review" });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar prova.");
    } finally {
      setBusy(false);
    }
  };

  const doReview = async (submissionId: string, decision: "approve" | "reject") => {
    setBusy(true);
    try {
      await reviewFn({ data: { submission_id: submissionId, decision } });
      toast.success(decision === "approve" ? "Pago on-chain!" : "Submissão rejeitada.");
      refetch();
      onChanged({ ...bounty, status: decision === "approve" ? "completed" : "open" });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao revisar submissão.");
    } finally {
      setBusy(false);
    }
  };

  const doRefund = async () => {
    setBusy(true);
    try {
      await refundFn({ data: { bounty_id: bounty.id } });
      toast.success("Bounty cancelada e reembolsada.");
      onChanged({ ...bounty, status: "refunded" });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao cancelar.");
    } finally {
      setBusy(false);
    }
  };

  const doConfirmDeposit = async () => {
    setBusy(true);
    try {
      await confirmDepositFn({
        data: { bounty_id: bounty.id, signature: depositSig.trim() || undefined },
      });
      toast.success("Depósito confirmado — bounty publicada!");
      onChanged({ ...bounty, status: "open" });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível confirmar o depósito.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle className="flex-1">{bounty.title}</DialogTitle>
            <Badge variant={STATUS_VARIANT[bounty.status] ?? "outline"}>
              {STATUS_LABEL[bounty.status] ?? bounty.status}
            </Badge>
          </div>
          <DialogDescription className="whitespace-pre-wrap text-foreground/80">
            {linkifyText(bounty.description)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 font-display font-bold text-xl text-primary">
            <Coins className="h-5 w-5" />
            {bounty.reward_amount.toLocaleString("pt-BR")} {bounty.token_symbol ?? ""}
          </div>
          {typeof window !== "undefined" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Compartilhar:</span>
              <ShareButtons
                url={`${window.location.origin}/bounties?b=${bounty.id}`}
                text={`Bounty: ${bounty.title} — ${bounty.reward_amount} ${bounty.token_symbol ?? ""}`}
              />
            </div>
          )}
        </div>

        {isCreator && bounty.status === "awaiting_deposit" && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 space-y-3">
            <div className="font-medium text-sm flex items-center gap-1.5">
              <Wallet className="h-4 w-4" /> Confirmar depósito
            </div>
            <p className="text-sm text-muted-foreground">
              Envie {bounty.reward_amount.toLocaleString("pt-BR")} {bounty.token_symbol ?? "tokens"} para o cofre e clique em verificar. A validação lê o saldo real on-chain.
            </p>
            <div className="rounded-md border bg-background p-2">
              <div className="text-xs text-muted-foreground mb-1">Endereço do cofre</div>
              <code className="text-xs break-all">{bounty.vault_address}</code>
            </div>
            <Input
              value={depositSig}
              onChange={(e) => setDepositSig(e.target.value)}
              placeholder="Assinatura da transação (opcional)"
            />
            <Button size="sm" onClick={doConfirmDeposit} disabled={busy} className="w-full">
              {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Verificar depósito e publicar
            </Button>
          </div>
        )}

        {isCreator && bounty.status === "open" && (
          <div className="rounded-lg border p-3 text-sm text-muted-foreground flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" /> Você criou essa bounty.
            </span>
            <Button size="sm" variant="outline" onClick={doRefund} disabled={busy}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Cancelar e reembolsar
            </Button>
          </div>
        )}

        {!isCreator && bounty.status === "open" && user && (
          <div className="space-y-2 rounded-lg border p-3">
            <div className="font-medium text-sm">Enviar entrega</div>
            <Input
              placeholder="Link da prova (imagem, vídeo, post...)"
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
            />
            <Input
              placeholder="Sua carteira Solana (para receber o pagamento)"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
            />
            <Textarea
              placeholder="Nota opcional"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
            <Button size="sm" onClick={doSubmit} disabled={busy} className="w-full">
              {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Enviar prova
            </Button>
          </div>
        )}

        {!user && bounty.status === "open" && (
          <Link to="/auth">
            <Button size="sm" variant="outline" className="w-full">
              <Wallet className="mr-1.5 h-4 w-4" /> Entre para participar
            </Button>
          </Link>
        )}

        {(submissions ?? []).length > 0 && (
          <div className="space-y-2">
            <div className="font-medium text-sm">Submissões</div>
            {(submissions ?? []).map((s) => (
              <div key={s.id} className="rounded-lg border p-2.5 text-sm space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <a
                    href={s.proof_url}
                    target="_blank"
                    rel="noopener noreferrer nofollow ugc"
                    className="text-primary hover:underline truncate"
                  >
                    {s.proof_url}
                  </a>
                  <Badge
                    variant={
                      s.status === "approved"
                        ? "default"
                        : s.status === "rejected"
                          ? "destructive"
                          : "outline"
                    }
                  >
                    {s.status === "approved"
                      ? "Aprovada"
                      : s.status === "rejected"
                        ? "Rejeitada"
                        : "Pendente"}
                  </Badge>
                </div>
                {s.note && <p className="text-muted-foreground">{s.note}</p>}
                {isCreator && s.status === "pending" && (
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => doReview(s.id, "approve")}
                      disabled={busy}
                      className="flex-1"
                    >
                      <Check className="mr-1 h-3.5 w-3.5" /> Aprovar e pagar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => doReview(s.id, "reject")}
                      disabled={busy}
                      className="flex-1"
                    >
                      <X className="mr-1 h-3.5 w-3.5" /> Rejeitar
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
