import { createFileRoute } from "@tanstack/react-router";
import { Feed } from "@/components/Feed";
import { NewPostForm } from "@/components/NewPostForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/comunidade")({
  component: Comunidade,
  head: () => ({
    meta: [
      { title: "Comunidade — WEB3BRASIL" },
      {
        name: "description",
        content: "Feed da comunidade WEB3BRASIL: postagens, discussões e tokens nacionais.",
      },
    ],
  }),
});

function Comunidade() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
      <h1 className="font-display text-2xl font-bold">{t("community.title")}</h1>
      <NewPostForm />
      <Tabs defaultValue="hot">
        <TabsList>
          <TabsTrigger value="hot">{t("community.tab.hot")}</TabsTrigger>
          <TabsTrigger value="recent">{t("community.tab.recent")}</TabsTrigger>
        </TabsList>
        <TabsContent value="hot">
          <Feed sort="hot" />
        </TabsContent>
        <TabsContent value="recent">
          <Feed sort="recent" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

