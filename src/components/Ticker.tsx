import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getUsdBrlRate, lookupToken, formatBRL } from "@/lib/token-lookup";

type TickerItem = {
  key: string;
  symbol: string;
  priceBrl: number | null;
  change24h: number | null;
  image?: string | null;
};

const MAJORS = [
  { id: "bitcoin", symbol: "BTC" },
  { id: "ethereum", symbol: "ETH" },
  { id: "solana", symbol: "SOL" },
  { id: "binancecoin", symbol: "BNB" },
];

async function fetchMajors(): Promise<TickerItem[]> {
  try {
    const ids = MAJORS.map((m) => m.id).join(",");
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=brl&include_24hr_change=true`,
    );
    const j = await r.json();
    return MAJORS.map((m) => ({
      key: m.symbol,
      symbol: m.symbol,
      priceBrl: j?.[m.id]?.brl ?? null,
      change24h: j?.[m.id]?.brl_24h_change ?? null,
    }));
  } catch {
    return MAJORS.map((m) => ({ key: m.symbol, symbol: m.symbol, priceBrl: null, change24h: null }));
  }
}

async function fetchListedTokens(): Promise<TickerItem[]> {
  const { data } = await supabase
    .from("posts")
    .select("token_symbol, token_contract")
    .eq("type", "token")
    .not("token_contract", "is", null);
  if (!data?.length) return [];
  const uniq = new Map<string, { symbol: string; contract: string }>();
  for (const p of data) {
    const c = (p.token_contract ?? "").trim();
    if (!c || uniq.has(c.toLowerCase())) continue;
    uniq.set(c.toLowerCase(), { symbol: p.token_symbol ?? "", contract: c });
  }
  const list = Array.from(uniq.values()).slice(0, 20);
  const rate = await getUsdBrlRate();
  const results = await Promise.all(
    list.map(async (t) => {
      const info = await lookupToken(t.contract).catch(() => null);
      if (!info) return null;
      return {
        key: t.contract,
        symbol: info.symbol || t.symbol || "?",
        priceBrl: info.priceUsd != null ? info.priceUsd * rate : null,
        change24h: info.priceChange24h,
        image: info.image,
      } as TickerItem;
    }),
  );
  return results.filter((x): x is TickerItem => !!x);
}

export function Ticker() {
  const { data: majors = [] } = useQuery({
    queryKey: ["ticker-majors"],
    queryFn: fetchMajors,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
  const { data: listed = [] } = useQuery({
    queryKey: ["ticker-listed"],
    queryFn: fetchListedTokens,
    refetchInterval: 60_000,
    staleTime: 45_000,
  });

  const items = [...majors, ...listed];
  if (!items.length) return null;
  const loop = [...items, ...items];

  return (
    <div className="border-b bg-background/70 backdrop-blur overflow-hidden">
      <div className="relative">
        <div className="flex gap-6 py-1.5 whitespace-nowrap animate-[ticker_60s_linear_infinite] hover:[animation-play-state:paused]">
          {loop.map((it, i) => {
            const up = (it.change24h ?? 0) >= 0;
            return (
              <div key={`${it.key}-${i}`} className="flex items-center gap-2 text-xs font-mono shrink-0">
                {it.image ? (
                  <img src={it.image} alt="" className="h-4 w-4 rounded-full" />
                ) : (
                  <span className="h-4 w-4 rounded-full bg-primary/20 text-primary text-[9px] font-bold flex items-center justify-center">
                    {it.symbol[0]}
                  </span>
                )}
                <span className="font-semibold">{it.symbol}</span>
                <span>{it.priceBrl != null ? formatBRL(it.priceBrl) : "—"}</span>
                {it.change24h != null && (
                  <span className={up ? "text-green-500" : "text-red-500"}>
                    {up ? "+" : ""}
                    {it.change24h.toFixed(2)}%
                  </span>
                )}
                <span className="text-muted-foreground">•</span>
              </div>
            );
          })}
        </div>
      </div>
      <style>{`@keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </div>
  );
}
