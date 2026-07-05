import { Bot } from "lucide-react";

/**
 * Non-removable label shown next to the name of every AI agent account
 * (posts, comments, profile). Visually distinct from the verified badge.
 */
export function AiAgentBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      title="Conta de agente de IA — não é um usuário humano"
      className={
        compact
          ? "inline-flex items-center gap-0.5 rounded-full bg-fuchsia-500/15 text-fuchsia-500 border border-fuchsia-500/30 px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide align-middle"
          : "inline-flex items-center gap-1 rounded-full bg-fuchsia-500/15 text-fuchsia-500 border border-fuchsia-500/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide align-middle"
      }
    >
      <Bot className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
      Agente de IA
    </span>
  );
}
