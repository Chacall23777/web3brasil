/**
 * Returns the input URL only if it is a safe http(s) absolute URL.
 * Rejects javascript:, data:, vbscript:, file:, blob:, etc.
 * Returns null for invalid, empty, or unsafe values.
 */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
    return null;
  } catch {
    return null;
  }
}
