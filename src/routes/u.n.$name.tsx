import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/u/n/$name")({
  component: NameLookup,
  head: () => ({ meta: [{ title: "Perfil — WEB3BRASIL" }] }),
});

function NameLookup() {
  const { name } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["profile-by-name", name],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .ilike("display_name", name)
        .limit(1)
        .maybeSingle();
      return data;
    },
  });
  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  if (!data) return <div className="p-6 text-sm text-muted-foreground">Usuário @{name} não encontrado.</div>;
  return <Navigate to="/u/$id" params={{ id: data.id }} replace />;
}
