import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/mensagens/")({
  component: () => (
    <div className="flex-1 flex items-center justify-center p-8 text-sm text-muted-foreground text-center">
      Selecione uma conversa ou visite o perfil de um usuário para enviar uma mensagem.
    </div>
  ),
});
