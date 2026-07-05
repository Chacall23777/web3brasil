import { useEffect, useState, useCallback } from "react";
import { Download, Share, Plus, X, Zap, Bell, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_MS = 1000 * 60 * 60 * 24 * 3; // 3 days snooze on "agora não"
const FORCE_KEY = "pwa-install-force";
const REQUEST_EVENT = "pwa-install-request";

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

/**
 * Call after signup (or any moment) to force-show the PWA install prompt,
 * bypassing the "agora não" snooze. Safe to call on server (no-op).
 */
export function requestInstallPrompt() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(FORCE_KEY, "1");
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(REQUEST_EVENT));
}

export function InstallPWA() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [forced, setForced] = useState(false);

  const iosDevice = typeof window !== "undefined" && isIos();

  const showIfEligible = useCallback((force: boolean) => {
    if (isStandalone()) return;
    if (!force && recentlyDismissed()) return;
    setForced(force);
    setVisible(true);
  }, []);

  useEffect(() => {
    if (isStandalone()) return;

    // Check force flag from signup
    let force = false;
    try {
      if (sessionStorage.getItem(FORCE_KEY) === "1") {
        sessionStorage.removeItem(FORCE_KEY);
        force = true;
      }
    } catch {
      // ignore
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      showIfEligible(force);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };
    const onRequest = () => showIfEligible(true);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener(REQUEST_EVENT, onRequest);

    // On iOS (no beforeinstallprompt) or as fallback, show after short delay
    const t = setTimeout(() => showIfEligible(force), force ? 400 : 1800);

    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener(REQUEST_EVENT, onRequest);
    };
  }, [showIfEligible]);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setVisible(false);
    setForced(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
    setForced(false);
  };

  if (!visible) return null;

  const canInstallDirect = !iosDevice && !!deferred;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-install-title"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-primary/20 bg-card shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300">
        <button
          onClick={dismiss}
          aria-label="Fechar"
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-primary/20 text-primary flex items-center justify-center shrink-0 ring-1 ring-primary/30">
              <img
                src="/icons/icon-192.png"
                alt=""
                className="h-10 w-10 rounded-lg"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <div className="min-w-0">
              <h2 id="pwa-install-title" className="font-bold text-lg leading-tight">
                Instalar WEB3BRASIL
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Experiência de aplicativo nativo
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 pb-4 space-y-2.5">
          <div className="flex items-center gap-3 text-sm">
            <Zap className="h-4 w-4 text-primary shrink-0" />
            <span>Acesso rápido direto da tela inicial</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Bell className="h-4 w-4 text-primary shrink-0" />
            <span>Receba notificações em tempo real</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Smartphone className="h-4 w-4 text-primary shrink-0" />
            <span>Tela cheia, sem barra do navegador</span>
          </div>
        </div>

        {iosDevice && (
          <div className="mx-6 mb-4 rounded-lg bg-muted/50 border p-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              No iPhone/iPad, toque em{" "}
              <Share className="inline h-3.5 w-3.5 align-text-bottom text-primary" />{" "}
              <span className="font-medium text-foreground">Compartilhar</span> e depois em{" "}
              <Plus className="inline h-3.5 w-3.5 align-text-bottom text-primary" />{" "}
              <span className="font-medium text-foreground">"Adicionar à Tela de Início"</span>.
            </p>
          </div>
        )}

        {!iosDevice && !deferred && (
          <div className="mx-6 mb-4 rounded-lg bg-muted/50 border p-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              No menu do seu navegador, procure por{" "}
              <span className="font-medium text-foreground">"Instalar aplicativo"</span> ou{" "}
              <span className="font-medium text-foreground">"Adicionar à tela inicial"</span>.
            </p>
          </div>
        )}

        <div className="px-6 pb-6 flex gap-2">
          {canInstallDirect && (
            <Button onClick={install} className="flex-1 gap-2">
              <Download className="h-4 w-4" />
              Instalar
            </Button>
          )}
          <Button
            variant={canInstallDirect ? "outline" : "default"}
            onClick={dismiss}
            className={canInstallDirect ? "" : "flex-1"}
          >
            {forced ? "Agora não" : "Agora não"}
          </Button>
        </div>
      </div>
    </div>
  );
}
