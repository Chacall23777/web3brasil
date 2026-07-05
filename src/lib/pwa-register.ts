// Guarded service-worker registration wrapper.
// Registers /sw.js only in the published production app; never in Lovable
// preview, dev, iframes, or when ?sw=off is present.

const SW_URL = "/sw.js";

function isBlockedHost(hostname: string): boolean {
  if (hostname.startsWith("id-preview--") || hostname.startsWith("preview--")) return true;
  if (hostname === "lovableproject.com" || hostname.endsWith(".lovableproject.com")) return true;
  if (hostname === "lovableproject-dev.com" || hostname.endsWith(".lovableproject-dev.com")) return true;
  if (hostname === "beta.lovable.dev" || hostname.endsWith(".beta.lovable.dev")) return true;
  return false;
}

async function unregisterMatching(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((r) => (r.active?.scriptURL ?? "").endsWith(SW_URL))
        .map((r) => r.unregister()),
    );
  } catch {
    // ignore
  }
}

export function registerPWA(): void {
  if (typeof window === "undefined") return;
  if (!import.meta.env.PROD) {
    void unregisterMatching();
    return;
  }
  if (window.self !== window.top) {
    void unregisterMatching();
    return;
  }
  const { hostname, search } = window.location;
  if (isBlockedHost(hostname) || new URLSearchParams(search).has("sw")) {
    void unregisterMatching();
    return;
  }
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register(SW_URL).catch(() => {
      // ignore registration errors
    });
  });
}
