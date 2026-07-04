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

export function UserSocialTags({ handles, size = 12 }: { handles: Handles; size?: number }) {
  const items: Array<{ kind: "telegram" | "x" | "instagram"; raw: string }> = [];
  if (handles.telegram_handle) items.push({ kind: "telegram", raw: handles.telegram_handle });
  if (handles.x_handle) items.push({ kind: "x", raw: handles.x_handle });
  if (handles.instagram_handle) items.push({ kind: "instagram", raw: handles.instagram_handle });
  if (!items.length) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {items.map(({ kind, raw }) => {
        const { href, label } = normalize(kind, raw);
        const Icon = kind === "telegram" ? TelegramIcon : kind === "x" ? XIcon : InstagramIcon;
        return (
          <a
            key={kind}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full border bg-muted/40 hover:bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
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
