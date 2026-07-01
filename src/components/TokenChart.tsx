/**
 * Embed GeckoTerminal para gráfico estilo TradingView.
 * Precisa da rede no formato do GeckoTerminal (ex: solana, eth, bsc, polygon_pos, base).
 * Se a rede não estiver mapeada, mostra um link para busca manual.
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
  if (!c || !contract) {
    return (
      <div className="rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground text-center">
        Gráfico indisponível — rede ou contrato não informados corretamente.
      </div>
    );
  }
  // GeckoTerminal por token (mostra pool principal com candles + volume + timeframes)
  const src = `https://www.geckoterminal.com/${c}/tokens/${contract}?embed=1&info=0&swaps=0&chart=1`;
  return (
    <div className="rounded-lg overflow-hidden border bg-card">
      <iframe
        title="Gráfico do token"
        src={src}
        className="w-full h-[520px] md:h-[600px] block"
        loading="lazy"
        allow="clipboard-write"
      />
      <div className="px-3 py-2 border-t text-xs text-muted-foreground flex items-center justify-between">
        <span>Dados: GeckoTerminal · {c.toUpperCase()}</span>
        <a
          href={`https://www.geckoterminal.com/${c}/tokens/${contract}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Abrir no GeckoTerminal ↗
        </a>
      </div>
    </div>
  );
}
