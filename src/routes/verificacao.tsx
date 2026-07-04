import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Wallet, Flame, ShieldCheck } from "lucide-react";
import {
  connectWallet,
  getTokenBalance,
  burnTokens,
  BURN_AMOUNT,
  VERIFICATION_MINT,
  type WalletKind,
} from "@/lib/solana-burn";
import { verifyBurn } from "@/lib/verification.functions";
import { VerifiedBadge } from "@/components/VerifiedBadge";

export const Route = createFileRoute("/verificacao")({
  component: VerificationPage,
  head: () => ({ meta: [{ title: "Verificação — WEB3BRASIL" }] }),
});

function VerificationPage() {
  const { user, profile, refreshProfile, loading } = useAuth();
  const navigate = useNavigate();
  const verifyBurnFn = useServerFn(verifyBurn);

  const [wallet, setWallet] = useState<string | null>(null);
  const [provider, setProvider] = useState<any>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [burning, setBurning] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const isVerified = (profile as any)?.is_verified === true;
  const method = (profile as any)?.verified_method as string | undefined;

  const doConnect = async (kind: WalletKind) => {
    try {
      const { provider: p, publicKeyStr } = await connectWallet(kind);
      setProvider(p);
      setWallet(publicKeyStr);
      setChecking(true);
      const bal = await getTokenBalance(publicKeyStr);
      setBalance(bal);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao conectar carteira");
    } finally {
      setChecking(false);
    }
  };

  const doBurn = async () => {
    if (!provider || !wallet) return;
    setBurning(true);
    try {
      const sig = await burnTokens(provider, wallet);
      toast.success("Queima confirmada. Validando…");
      await verifyBurnFn({ data: { signature: sig, wallet_address: wallet } });
      toast.success("Selo verificado concedido!");
      await refreshProfile();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao queimar");
    } finally {
      setBurning(false);
    }
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          Selo de verificado {isVerified && <VerifiedBadge size={22} />}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ganhe o selo amarelo de perfil verificado queimando <strong>3.000 $LEGAL</strong> na rede Solana.
        </p>
      </div>

      {isVerified ? (
        <div className="rounded-xl border bg-card p-4 flex items-start gap-3">
          <ShieldCheck className="text-yellow-500 mt-0.5" />
          <div className="text-sm">
            <div className="font-semibold">Você já é verificado.</div>
            <div className="text-muted-foreground">
              Método: {method === "admin" ? "concedido por administrador" : "queima on-chain"}.
            </div>
            <Link to="/perfil" className="text-primary hover:underline text-xs">Ir ao perfil</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <h2 className="font-semibold flex items-center gap-2"><Wallet size={16} /> 1. Conecte sua carteira</h2>
            <p className="text-xs text-muted-foreground">
              Sem custódia. Você assina e paga o gas em SOL na sua própria carteira. Nada é armazenado além do endereço público.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => doConnect("phantom")}>Phantom</Button>
              <Button variant="outline" onClick={() => doConnect("solflare")}>Solflare</Button>
              <Button variant="outline" onClick={() => doConnect("backpack")}>Backpack</Button>
            </div>
            {wallet && (
              <div className="text-xs text-muted-foreground font-mono break-all">
                Conectado: {wallet}
              </div>
            )}
          </div>

          {wallet && (
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <h2 className="font-semibold flex items-center gap-2"><Flame size={16} /> 2. Queime 3.000 $LEGAL</h2>
              <p className="text-xs text-muted-foreground break-all">
                Mint: <span className="font-mono">{VERIFICATION_MINT}</span>
              </p>
              {checking ? (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="animate-spin" size={14} /> Verificando saldo…
                </div>
              ) : balance != null ? (
                <div className="text-sm">
                  Saldo atual: <span className="font-semibold">{balance.toLocaleString("pt-BR")}</span>
                  {balance < BURN_AMOUNT && (
                    <div className="text-destructive text-xs mt-1">
                      Você precisa de pelo menos {BURN_AMOUNT} tokens para se verificar.
                    </div>
                  )}
                </div>
              ) : null}
              <Button
                onClick={doBurn}
                disabled={burning || balance == null || balance < BURN_AMOUNT}
              >
                {burning ? (
                  <><Loader2 className="animate-spin" size={14} /> Queimando…</>
                ) : (
                  <>Queimar {BURN_AMOUNT} tokens</>
                )}
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Se o RPC público estiver instável, aguarde alguns instantes e tente novamente.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
