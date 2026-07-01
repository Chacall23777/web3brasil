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

type TokenRow = {
  id: string;
  contract_address: string;
  chain: string;
  ordem: number;
  ativo: boolean;
  fonte: "coingecko" | "dexscreener";
  symbol: string | null;
};

async function fetchCoingecko(rows: TokenRow[]): Promise<TickerItem[]> {
  if (!rows.length) return [];
  try {
    const ids = rows.map((r) => r.contract_address).join(",");
    const r = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=brl&include_24hr_change=true`,
    );
    const j = await r.json();
    return rows.map((row) => ({
      key: row.id,
      symbol: (row.symbol || row.contract_address).toUpperCase(),
      priceBrl: j?.[row.contract_address]?.brl ?? null,
      change24h: j?.[row.contract_address]?.brl_24h_change ?? null,
    }));
  } catch {
    return rows.map((row) => ({
      key: row.id,
      symbol: (row.symbol || row.contract_address).toUpperCase(),
      priceBrl: null,
      change24h: null,
    }));
  }
}

async function fetchDex(rows: TokenRow[]): Promise<TickerItem[]> {
  if (!rows.length) return [];
  const rate = await getUsdBrlRate();
  const results = await Promise.all(
    rows.map(async (row) => {
      const info = await lookupToken(row.contract_address).catch(() => null);
      if (!info) return null;
      return {
        key: row.id,
        symbol: info.symbol || row.symbol || "?",
        priceBrl: info.priceUsd != null ? info.priceUsd * rate : null,
        change24h: info.priceChange24h,
        image: info.image,
      } as TickerItem;
    }),
  );
  return results.filter((x): x is TickerItem => !!x);
}

async function fetchAll(): Promise<TickerItem[]> {
  const { data } = await supabase
    .from("ticker_tokens")
    .select("id, contract_address, chain, ordem, ativo, fonte, symbol")
    .eq("ativo", true)
    .order("ordem", { ascending: true });
  const rows = ((data ?? []) as unknown as TokenRow[]);
  const cg = rows.filter((r) => r.fonte === "coingecko");
  const dx = rows.filter((r) => r.fonte !== "coingecko");
  const [a, b] = await Promise.all([fetchCoingecko(cg), fetchDex(dx)]);
  // Preserve original order from `rows`
  const byId = new Map<string, TickerItem>();
  [...a, ...b].forEach((it) => byId.set(it.key, it));
  return rows.map((r) => byId.get(r.id)).filter((x): x is TickerItem => !!x);
}

export function Ticker() {
  const { data: config } = useQuery({
    queryKey: ["ticker_config"],
    queryFn: async () =>
      (await supabase.from("ticker_config").select("speed_seconds").eq("id", 1).maybeSingle()).data,
    staleTime: 60_000,
  });
  const { data: items = [] } = useQuery({
    queryKey: ["ticker-all"],
    queryFn: fetchAll,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  if (!items.length) return null;
  const loop = [...items, ...items];
  const speed = config?.speed_seconds ?? 15;

  return (
    <div className="border-b bg-background/70 backdrop-blur overflow-hidden">
      <div className="relative">
        <div
          className="flex gap-6 py-1.5 whitespace-nowrap hover:[animation-play-state:paused]"
          style={{ animation: `ticker ${speed}s linear infinite` }}
        >
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
