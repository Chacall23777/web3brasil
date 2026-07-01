import { useQuery } from "@tanstack/react-query";
import { lookupToken, getUsdBrlRate, formatBRL } from "@/lib/token-lookup";

/**
 * Embed GeckoTerminal para gráfico estilo TradingView + estatísticas em BRL via DexScreener.
 */
const chainMap: Record<string, string> = {
  solana: "solana",
  sol: "solana",
  ethereum: "eth",
  eth: "eth",
  bsc: "bsc",
  bnb: "bsc",
  polygon: "polygon_pos",
  matic: "polygon_pos",
  base: "base",
  arbitrum: "arbitrum",
  arb: "arbitrum",
  optimism: "optimism",
  op: "optimism",
  avalanche: "avax",
  avax: "avax",
};

export function normalizeChain(chain: string | null | undefined) {
  if (!chain) return null;
  return chainMap[chain.toLowerCase().trim()] ?? null;
}

export function TokenChart({ chain, contract }: { chain: string | null; contract: string | null }) {
  const c = normalizeChain(chain);
  const { data: stats } = useQuery({
    queryKey: ["token-stats", contract],
    queryFn: async () => {
      if (!contract) return null;
      const [info, rate] = await Promise.all([lookupToken(contract), getUsdBrlRate()]);
      return info ? { info, rate } : null;
    },
    enabled: !!contract,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (!c || !contract) {
    return (
      <div className="rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground text-center">
        Gráfico indisponível — rede ou contrato não informados corretamente.
      </div>
    );
  }

  const priceBrl = stats ? (stats.info.priceUsd ?? 0) * stats.rate : null;
  const change = stats?.info.priceChange24h ?? null;
  const changeColor = change == null ? "text-muted-foreground" : change >= 0 ? "text-green-500" : "text-red-500";
  const liqBrl = stats ? (stats.info.liquidityUsd ?? 0) * stats.rate : null;
  const volBrl = stats ? (stats.info.volume24hUsd ?? 0) * stats.rate : null;
  const fdvBrl = stats ? (stats.info.fdvUsd ?? 0) * stats.rate : null;

  const src = `https://www.geckoterminal.com/${c}/tokens/${contract}?embed=1&info=0&swaps=0&chart=1`;

  return (
    <div className="rounded-lg overflow-hidden border bg-card">
      {stats && (
        <div className="px-4 py-3 border-b grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <Stat label="Preço (BRL)" value={priceBrl != null ? formatBRL(priceBrl) : "—"} big />
          <Stat label="24h" value={change != null ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%` : "—"} valueClass={changeColor} big />
          <Stat label="Liquidez" value={liqBrl != null ? formatBRL(liqBrl, { compact: true }) : "—"} />
          <Stat label="Volume 24h" value={volBrl != null ? formatBRL(volBrl, { compact: true }) : "—"} />
          <Stat label="FDV / MCap" value={fdvBrl != null ? formatBRL(fdvBrl, { compact: true }) : "—"} />
        </div>
      )}
      <iframe
        title="Gráfico do token"
        src={src}
        className="w-full h-[520px] md:h-[600px] block"
        loading="lazy"
        allow="clipboard-write"
      />
      <div className="px-3 py-2 border-t text-xs text-muted-foreground flex items-center justify-between gap-2 flex-wrap">
        <span>Preços em BRL via DexScreener · Gráfico via GeckoTerminal · {c.toUpperCase()}</span>
        <a
          href={stats?.info.pairUrl ?? `https://www.geckoterminal.com/${c}/tokens/${contract}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Abrir gráfico completo ↗
        </a>
      </div>
    </div>
  );
}

function Stat({ label, value, valueClass = "", big = false }: { label: string; value: string; valueClass?: string; big?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`${big ? "text-base" : "text-sm"} font-semibold font-mono truncate ${valueClass}`}>{value}</div>
    </div>
  );
}
