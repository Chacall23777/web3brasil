import { useEffect, useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
}

function recentlyDismissed(): boolean {
  try {
    const v = localStorage.getItem(DISMISS_KEY);
    if (!v) return false;
    return Date.now() - Number(v) < DISMISS_MS;
  } catch {
    return false;
  }
}

export function InstallPWA() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    if (isIos()) {
      const t = setTimeout(() => {
        setShowIos(true);
        setVisible(true);
      }, 2500);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onPrompt);
        window.removeEventListener("appinstalled", onInstalled);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 z-50 md:left-auto md:right-4 md:max-w-sm">
      <div className="rounded-xl border bg-card shadow-lg p-4 flex gap-3 items-start">
        <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
          <Download className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">Instalar WEB3BRASIL</div>
          {showIos ? (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Toque em <Share className="inline h-3.5 w-3.5 align-text-bottom" /> Compartilhar
              e depois em <Plus className="inline h-3.5 w-3.5 align-text-bottom" /> "Adicionar à Tela de Início".
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              Adicione o app à sua tela inicial para acesso rápido e experiência em tela cheia.
            </p>
          )}
          {!showIos && (
            <div className="mt-3">
              <Button size="sm" onClick={install}>Instalar</Button>
            </div>
          )}
        </div>
        <button
          onClick={dismiss}
          aria-label="Fechar"
          className="text-muted-foreground hover:text-foreground -mr-1 -mt-1 p-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
