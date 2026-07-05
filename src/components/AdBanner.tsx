import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Globe } from "lucide-react";
import { XIcon, TelegramIcon } from "./SocialIcons";

type Ad = {
  id: string;
  image_url: string;
  title: string | null;
  tg_link: string | null;
  x_link: string | null;
  website_link: string | null;
  expires_at: string;
};

export function AdBanner() {
  const nowIso = new Date().toISOString();
  const { data: ads } = useQuery({
    queryKey: ["ads_active"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("advertisements")
        .select("id,image_url,title,tg_link,x_link,website_link,expires_at")
        .eq("is_active", true)
        .gt("expires_at", nowIso)
        .order("created_at", { ascending: false });
      return (data ?? []) as Ad[];
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const [idx, setIdx] = useState(0);
  const list = ads ?? [];

  useEffect(() => {
    if (list.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % list.length), 5000);
    return () => clearInterval(t);
  }, [list.length]);

  if (list.length === 0) return null;
  const ad = list[idx % list.length];

  return (
    <div className="relative overflow-hidden border-b bg-gradient-to-r from-fuchsia-600 via-orange-500 to-yellow-400 animate-[adshine_6s_ease_infinite] bg-[length:200%_200%]">
      <div className="mx-auto max-w-6xl px-3 py-2 flex items-center gap-3">
        <img
          src={ad.image_url}
          alt={ad.title ?? "Anúncio"}
          className="h-12 w-12 md:h-14 md:w-14 rounded-lg object-cover border-2 border-white/70 shadow-lg shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-widest font-bold text-white/90 drop-shadow">
            Patrocinado
          </div>
          {ad.title && (
            <div className="text-sm md:text-base font-extrabold text-white drop-shadow truncate">
              {ad.title}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {ad.tg_link && (
            <a
              href={ad.tg_link}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Telegram"
              className="h-8 w-8 rounded-full bg-white/95 text-[#229ED9] flex items-center justify-center shadow hover:scale-110 transition"
            >
              <TelegramIcon width={16} height={16} />
            </a>
          )}
          {ad.x_link && (
            <a
              href={ad.x_link}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X"
              className="h-8 w-8 rounded-full bg-black text-white flex items-center justify-center shadow hover:scale-110 transition"
            >
              <XIcon width={14} height={14} />
            </a>
          )}
          {ad.website_link && (
            <a
              href={ad.website_link}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Site"
              className="h-8 w-8 rounded-full bg-white/95 text-fuchsia-700 flex items-center justify-center shadow hover:scale-110 transition"
            >
              <Globe size={16} />
            </a>
          )}
        </div>
        {list.length > 1 && (
          <div className="hidden sm:flex items-center gap-1 shrink-0 ml-1">
            {list.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === idx % list.length ? "w-4 bg-white" : "w-1.5 bg-white/50"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
