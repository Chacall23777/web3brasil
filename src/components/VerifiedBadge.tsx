import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function VerifiedBadge({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <span
      title="Perfil verificado"
      aria-label="Perfil verificado"
      className={cn("inline-flex items-center text-yellow-500", className)}
    >
      <BadgeCheck size={size} className="fill-yellow-400 text-black" />
    </span>
  );
}
