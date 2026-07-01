import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { XIcon, TelegramIcon } from "@/components/SocialIcons";

export const Route = createFileRoute("/equipe")({
  component: EquipePage,
  head: () => ({
    meta: [
      { title: "Equipe — WEB3BRASIL" },
      { name: "description", content: "Conheça o time por trás da WEB3BRASIL." },
    ],
  }),
});

function EquipePage() {
  const { data } = useQuery({
    queryKey: ["team_members"],
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("*").order("sort_order").order("created_at");
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
      <h1 className="font-display text-2xl font-bold">Equipe</h1>
      {(!data || data.length === 0) ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          A equipe ainda será apresentada.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {data.map((m: any) => (
            <div key={m.id} className="rounded-xl border bg-card p-4 text-center">
              {m.avatar_url ? (
                <img src={m.avatar_url} alt="" className="h-24 w-24 rounded-full mx-auto object-cover border" />
              ) : (
                <div className="h-24 w-24 rounded-full mx-auto bg-primary/20 text-primary flex items-center justify-center text-3xl font-bold">
                  {(m.name ?? "?")[0]}
                </div>
              )}
              <div className="font-display font-semibold mt-3">{m.name}</div>
              <div className="text-xs text-muted-foreground">{m.role}</div>
              <div className="mt-3 flex justify-center gap-2">
                {m.x_url && <a href={m.x_url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-primary" aria-label="X"><XIcon width={16} height={16} /></a>}
                {m.telegram_url && <a href={m.telegram_url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-primary" aria-label="Telegram"><TelegramIcon width={16} height={16} /></a>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
