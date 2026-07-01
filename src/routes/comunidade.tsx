import { createFileRoute } from "@tanstack/react-router";
import { Feed } from "@/components/Feed";
import { NewPostForm } from "@/components/NewPostForm";

export const Route = createFileRoute("/comunidade")({
  component: Comunidade,
  head: () => ({
    meta: [
      { title: "Comunidade — WEB3BRASIL" },
      { name: "description", content: "Feed da comunidade WEB3BRASIL: postagens, discussões e tokens nacionais." },
    ],
  }),
});

function Comunidade() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
      <h1 className="font-display text-2xl font-bold">Comunidade</h1>
      <NewPostForm />
      <Feed />
    </div>
  );
}
