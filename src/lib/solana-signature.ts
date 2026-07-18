// Client-safe helpers to sanitize/validate a Solana transaction signature.
// Accepts a raw base58 signature OR an explorer URL (Solscan, Solana Explorer,
// SolanaFM, XRAY, etc.) and returns the bare signature.

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;

export function isValidSolanaSignature(value: string): boolean {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (v.length < 64 || v.length > 100) return false;
  return BASE58_RE.test(v);
}

/**
 * Extracts a Solana transaction signature from a raw string or an explorer URL.
 * - Strips query strings, fragments, and known path segments like `/tx/`, `/transaction/`.
 * - Returns null if no valid base58 signature (64–100 chars) can be found.
 */
export function extractSolanaSignature(input: string | null | undefined): string | null {
  if (!input) return null;
  let raw = String(input).trim();
  if (!raw) return null;

  // If it looks like a URL, parse it.
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      // Take last non-empty path segment (Solscan: /tx/<sig>, Explorer: /tx/<sig>).
      const segs = url.pathname.split("/").filter(Boolean);
      raw = segs[segs.length - 1] ?? "";
    } catch {
      // fall through — try to salvage below
    }
  }

  // Strip any leftover query/fragment or whitespace.
  raw = raw.split("?")[0].split("#")[0].trim();

  if (isValidSolanaSignature(raw)) return raw;

  // Last-resort: scan the original string for a base58 chunk of plausible length.
  const m = String(input).match(/[1-9A-HJ-NP-Za-km-z]{64,100}/);
  if (m && isValidSolanaSignature(m[0])) return m[0];

  return null;
}
