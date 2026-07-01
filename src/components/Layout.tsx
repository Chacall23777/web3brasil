import { Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { XIcon, TelegramIcon, WhatsappIcon, InstagramIcon } from "./SocialIcons";
import { Ticker } from "./Ticker";

export function Layout() {
  const { user, profile, isAdmin, signOut, loading } = useAuth();
  const { data: social } = useQuery({
    queryKey: ["social_links"],
    queryFn: async () => {
      const { data } = await supabase.from("social_links").select("*").eq("id", 1).maybeSingle();
      return data;
    },
  });

  const socials = [
    { url: social?.x_url, Icon: XIcon, label: "X", bg: "bg-black text-white hover:bg-black/85" },
    { url: social?.telegram_url, Icon: TelegramIcon, label: "Telegram", bg: "bg-[#229ED9] text-white hover:bg-[#1c8ec4]" },
    { url: social?.whatsapp_url, Icon: WhatsappIcon, label: "WhatsApp", bg: "bg-[#25D366] text-white hover:bg-[#1ebe5a]" },
    { url: social?.instagram_url, Icon: InstagramIcon, label: "Instagram", bg: "bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] text-white hover:opacity-90" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <Ticker />
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-3">
          <Link to="/" className="font-display text-lg font-bold tracking-tight">
            <span className="text-primary">WEB3</span>BRASIL
          </Link>
          <nav className="hidden md:flex items-center gap-1 ml-4 text-sm">
            <Link to="/" activeOptions={{ exact: true }} className="px-3 py-1.5 rounded-md hover:bg-muted [&.active]:bg-muted" activeProps={{ className: "active" }}>Início</Link>
            <Link to="/comunidade" className="px-3 py-1.5 rounded-md hover:bg-muted" activeProps={{ className: "bg-muted" }}>Comunidade</Link>
            <Link to="/equipe" className="px-3 py-1.5 rounded-md hover:bg-muted" activeProps={{ className: "bg-muted" }}>Equipe</Link>
            {isAdmin && (
              <Link to="/admin" className="px-3 py-1.5 rounded-md hover:bg-muted text-primary" activeProps={{ className: "bg-muted" }}>Admin</Link>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5">
              {socials.map(({ url, Icon, label, bg }) =>
                url ? (
                  <a key={label} href={url} target="_blank" rel="noopener noreferrer" aria-label={label} className={`h-8 w-8 rounded-full flex items-center justify-center shadow-sm transition ${bg}`}>
                    <Icon width={16} height={16} />
                  </a>
                ) : null,
              )}
            </div>
            {loading ? (
              <div className="h-8 w-20 rounded-md bg-muted animate-pulse" />
            ) : user ? (
              <>
                <Link to="/perfil" className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-muted">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <div className="h-7 w-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                      {(profile?.display_name ?? "U")[0]}
                    </div>
                  )}
                  <span className="hidden md:inline text-sm">{profile?.display_name ?? "Perfil"}</span>
                </Link>
                <Button variant="ghost" size="sm" onClick={signOut}>Sair</Button>
              </>
            ) : (
              <Link to="/auth"><Button size="sm">Entrar</Button></Link>
            )}
          </div>
        </div>
        <nav className="md:hidden border-t px-2 py-1 flex items-center gap-1 overflow-x-auto text-sm">
          <Link to="/" className="px-3 py-1.5 rounded-md hover:bg-muted" activeOptions={{ exact: true }} activeProps={{ className: "bg-muted" }}>Início</Link>
          <Link to="/comunidade" className="px-3 py-1.5 rounded-md hover:bg-muted" activeProps={{ className: "bg-muted" }}>Comunidade</Link>
          <Link to="/equipe" className="px-3 py-1.5 rounded-md hover:bg-muted" activeProps={{ className: "bg-muted" }}>Equipe</Link>
          {isAdmin && <Link to="/admin" className="px-3 py-1.5 rounded-md hover:bg-muted text-primary" activeProps={{ className: "bg-muted" }}>Admin</Link>}
        </nav>
      </header>

      <main className="flex-1"><Outlet /></main>

      <footer className="border-t mt-10">
        <div className="mx-auto max-w-6xl px-4 py-8 flex flex-col md:flex-row gap-4 items-center justify-between text-sm text-muted-foreground">
          <div>© {new Date().getFullYear()} WEB3BRASIL — comunidade cripto BR.</div>
          <div className="flex items-center gap-2">
            {socials.map(({ url, Icon, label, bg }) =>
              url ? (
                <a key={label} href={url} target="_blank" rel="noopener noreferrer" aria-label={label} className={`h-9 w-9 rounded-full flex items-center justify-center shadow-sm transition ${bg}`}>
                  <Icon width={18} height={18} />
                </a>
              ) : null,
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
