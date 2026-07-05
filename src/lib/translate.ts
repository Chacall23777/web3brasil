import { supabase } from "@/integrations/supabase/client";

const CONTACT_EMAIL = "rogeriopereira289@gmail.com";

export type TranslateResult =
  | { ok: true; text: string; cached: boolean }
  | { ok: false; error: string };

/**
 * Translate `text` from `from` to `to` using MyMemory Translation API.
 * Free, no key. Includes the contact email for a higher daily quota.
 */
export async function translateWithMyMemory(
  text: string,
  from: "pt" | "en",
  to: "pt" | "en",
): Promise<TranslateResult> {
  if (from === to) return { ok: true, text, cached: false };
  try {
    const langpair = `${from === "pt" ? "pt-BR" : "en-US"}|${to === "pt" ? "pt-BR" : "en-US"}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      text.slice(0, 500),
    )}&langpair=${encodeURIComponent(langpair)}&de=${encodeURIComponent(CONTACT_EMAIL)}`;
    const res = await fetch(url);
    if (!res.ok) return { ok: false, error: `http_${res.status}` };
    const json = (await res.json()) as {
      responseData?: { translatedText?: string };
      responseStatus?: number;
      responseDetails?: string;
    };
    const translated = json.responseData?.translatedText;
    if (!translated || (json.responseStatus && json.responseStatus >= 400)) {
      return { ok: false, error: json.responseDetails || "no_translation" };
    }
    return { ok: true, text: translated, cached: false };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Cache a translation back onto the post via the SECURITY DEFINER RPC.
 * Only writes when the column is still null; silently ignores errors.
 */
export async function cachePostTranslation(postId: string, lang: "pt" | "en", text: string) {
  try {
    await (supabase as any).rpc("post_cache_translation", {
      _post_id: postId,
      _lang: lang,
      _text: text,
    });
  } catch {
    /* best-effort */
  }
}

/** Heuristic language detection: default to `fallback`, flip if latin-ish EN wins. */
export function detectLanguage(text: string, fallback: "pt" | "en" = "pt"): "pt" | "en" {
  const t = text.toLowerCase();
  if (!t.trim()) return fallback;
  // Portuguese-only characters
  if (/[ãõáéíóúâêôçà]/.test(t)) return "pt";
  const ptWords = /\b(que|não|sim|para|com|uma|isso|você|voce|hoje|obrigado|projeto|comunidade|também|tambem|muito|está|estao|estão|token|brasil)\b/g;
  const enWords = /\b(the|and|for|with|this|that|you|today|thanks|project|community|also|very|is|are|token|hello)\b/g;
  const pt = (t.match(ptWords) ?? []).length;
  const en = (t.match(enWords) ?? []).length;
  if (en > pt && en >= 2) return "en";
  if (pt > en) return "pt";
  return fallback;
}
