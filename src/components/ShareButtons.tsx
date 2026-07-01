import { XIcon, TelegramIcon, WhatsappIcon } from "./SocialIcons";
import { toast } from "sonner";
import { Link as LinkIcon } from "lucide-react";

export function ShareButtons({ url, text }: { url: string; text: string }) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(text);
  const shares = [
    { label: "WhatsApp", href: `https://wa.me/?text=${t}%20${u}`, Icon: WhatsappIcon },
    { label: "Telegram", href: `https://t.me/share/url?url=${u}&text=${t}`, Icon: TelegramIcon },
    { label: "X", href: `https://twitter.com/intent/tweet?url=${u}&text=${t}`, Icon: XIcon },
  ];
  return (
    <div className="flex items-center gap-1">
      {shares.map(({ label, href, Icon }) => (
        <a key={label} href={href} target="_blank" rel="noopener noreferrer"
          aria-label={`Compartilhar no ${label}`}
          className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-primary">
          <Icon width={16} height={16} />
        </a>
      ))}
      <button
        type="button"
        aria-label="Copiar link"
        className="p-2 rounded-md hover:bg-muted text-muted-foreground hover:text-primary"
        onClick={() => {
          navigator.clipboard.writeText(url).then(
            () => toast.success("Link copiado"),
            () => toast.error("Não deu para copiar"),
          );
        }}
      >
        <LinkIcon size={16} />
      </button>
    </div>
  );
}
