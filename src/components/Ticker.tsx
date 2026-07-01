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

async function fetchListedTokens(): Promise<TickerItem[]> {
  const { data } = await supabase
    .from("ticker_tokens")
    .select("contract_address")
    .eq("ativo", true)
    .order("ordem", { ascending: true });

  const list = (data ?? []).map((t) => t.contract_address).filter(Boolean);
  if (!list.length) return [];
  const rate = await getUsdBrlRate();
  const results = await Promise.all(
    list.map(async (addr) => {
      const info = await lookupToken(addr).catch(() => null);
      if (!info) return null;
      return {
        key: addr,
        symbol: info.symbol || "?",
        priceBrl: info.priceUsd != null ? info.priceUsd * rate : null,
        change24h: info.priceChange24h,
        image: info.image,
      } as TickerItem;
    }),
  );
  return results.filter((x): x is TickerItem => !!x);
}

export function Ticker() {
  const { data: config } = useQuery({
    queryKey: ["ticker_config"],
    queryFn: async () =>
      (await supabase.from("ticker_config").select("speed_seconds").eq("id", 1).maybeSingle()).data,
    staleTime: 60_000,
  });
  const { data: listed = [] } = useQuery({
    queryKey: ["ticker-listed"],
    queryFn: fetchListedTokens,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  const items = listed;
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
