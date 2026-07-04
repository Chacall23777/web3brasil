import { XIcon, TelegramIcon, InstagramIcon } from "./SocialIcons";

type Handles = {
  telegram_handle?: string | null;
  x_handle?: string | null;
  instagram_handle?: string | null;
};

function normalize(kind: "telegram" | "x" | "instagram", raw: string): { href: string; label: string } {
  const v = raw.trim().replace(/^@/, "");
  if (v.startsWith("http")) return { href: v, label: v.replace(/^https?:\/\//, "").slice(0, 40) };
  if (kind === "telegram") return { href: `https://t.me/${v}`, label: `@${v}` };
  if (kind === "x") return { href: `https://x.com/${v}`, label: `@${v}` };
  return { href: `https://instagram.com/${v}`, label: `@${v}` };
}

const VERIFIED_STYLES: Record<"telegram" | "x" | "instagram", string> = {
  telegram:
    "bg-gradient-to-r from-sky-400 to-blue-600 text-white border-sky-300 shadow-[0_0_10px_rgba(56,189,248,0.6)]",
  x: "bg-gradient-to-r from-neutral-800 to-black text-white border-neutral-500 shadow-[0_0_10px_rgba(255,255,255,0.35)]",
  instagram:
    "bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 text-white border-pink-300 shadow-[0_0_10px_rgba(236,72,153,0.6)]",
};

export function UserSocialTags({
  handles,
  size = 12,
  verified = false,
}: {
  handles: Handles;
  size?: number;
  verified?: boolean;
}) {
  const items: Array<{ kind: "telegram" | "x" | "instagram"; raw: string }> = [];
  if (handles.telegram_handle) items.push({ kind: "telegram", raw: handles.telegram_handle });
  if (handles.x_handle) items.push({ kind: "x", raw: handles.x_handle });
  if (handles.instagram_handle) items.push({ kind: "instagram", raw: handles.instagram_handle });
  if (!items.length) return null;

  return (
    <div className={verified ? "flex items-center gap-2 flex-wrap" : "flex items-center gap-1 flex-wrap"}>
      {items.map(({ kind, raw }) => {
        const { href, label } = normalize(kind, raw);
        const Icon = kind === "telegram" ? TelegramIcon : kind === "x" ? XIcon : InstagramIcon;
        if (verified) {
          const iconSize = Math.max(size + 6, 18);
          return (
            <a
              key={kind}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-transform hover:scale-110 animate-verified-pulse ${VERIFIED_STYLES[kind]}`}
              title={label}
              aria-label={`${kind}: ${label}`}
            >
              <Icon width={iconSize} height={iconSize} />
              <span className="hidden sm:inline">{label}</span>
            </a>
          );
        }
        return (
          <a
            key={kind}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-transform hover:scale-105"
            title={label}
          >
            <Icon width={size} height={size} />
            <span className="hidden sm:inline">{label}</span>
          </a>
        );
      })}
    </div>
  );
}
