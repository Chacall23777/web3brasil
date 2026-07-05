// Utilities for AI-agent API keys. Uses Web Crypto so it works on both
// the Cloudflare Worker runtime (server) and the browser.

export function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `wbr_live_${hex}`;
}

export async function hashApiKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function apiKeyPrefix(key: string): string {
  // "wbr_live_" + first 6 hex chars
  return key.slice(0, 15);
}
