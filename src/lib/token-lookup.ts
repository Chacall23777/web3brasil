// DexScreener é gratuito e não exige chave. Devolve nome/símbolo/rede/preço/etc.
// Docs: https://docs.dexscreener.com/api/reference

const dsToOurChain: Record<string, string> = {
  solana: "solana",
  ethereum: "ethereum",
  bsc: "bsc",
  polygon: "polygon",
  base: "base",
  arbitrum: "arbitrum",
  optimism: "optimism",
  avalanche: "avalanche",
};

export type TokenInfo = {
  name: string;
  symbol: string;
  chain: string; // nosso formato
  image: string | null;
  priceUsd: number | null;
  priceChange24h: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  fdvUsd: number | null;
  pairUrl: string | null;
  pairAddress: string | null;
};

export async function lookupToken(contract: string): Promise<TokenInfo | null> {
  const addr = contract.trim();
  if (!addr) return null;
  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(addr)}`);
  if (!res.ok) return null;
  const json = await res.json();
  const pairs: any[] = json?.pairs ?? [];
  if (!pairs.length) return null;
  // Pega o par com maior liquidez em USD
  pairs.sort((a, b) => (b?.liquidity?.usd ?? 0) - (a?.liquidity?.usd ?? 0));
  const p = pairs[0];
  const chain = dsToOurChain[p.chainId] ?? p.chainId;
  const isBase = p.baseToken?.address?.toLowerCase() === addr.toLowerCase();
  const tok = isBase ? p.baseToken : p.quoteToken;
  const info = p.info ?? {};
  return {
    name: tok?.name ?? "",
    symbol: tok?.symbol ?? "",
    chain,
    image: info.imageUrl ?? null,
    priceUsd: p.priceUsd ? Number(p.priceUsd) : null,
    priceChange24h: p.priceChange?.h24 ?? null,
    liquidityUsd: p.liquidity?.usd ?? null,
    volume24hUsd: p.volume?.h24 ?? null,
    fdvUsd: p.fdv ?? null,
    pairUrl: p.url ?? null,
    pairAddress: p.pairAddress ?? null,
  };
}

let brlRateCache: { rate: number; ts: number } | null = null;
export async function getUsdBrlRate(): Promise<number> {
  const now = Date.now();
  if (brlRateCache && now - brlRateCache.ts < 5 * 60_000) return brlRateCache.rate;
  try {
    const r = await fetch("https://open.er-api.com/v6/latest/USD");
    const j = await r.json();
    const rate = j?.rates?.BRL;
    if (typeof rate === "number") {
      brlRateCache = { rate, ts: now };
      return rate;
    }
  } catch {}
  // fallback razoável se a API falhar
  return brlRateCache?.rate ?? 5.4;
}

export function formatBRL(v: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (v == null || !isFinite(v)) return "—";
  const abs = Math.abs(v);
  if (opts.compact && abs >= 1000) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 2 }).format(v);
  }
  const digits = abs < 0.01 ? 6 : abs < 1 ? 4 : 2;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: digits }).format(v);
}
