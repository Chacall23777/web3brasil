import { ensureSolanaBufferPolyfill } from "./solana-buffer-polyfill";

// Public RPCs that allow browser CORS. Ordered by reliability.
const RPC_URLS = [
  "https://solana-rpc.publicnode.com",
  "https://rpc.ankr.com/solana",
  "https://api.mainnet-beta.solana.com",
];

// Jupiter metadata endpoints (fallback chain — old + new).
const JUP_META_URLS = (mint: string) => [
  `https://tokens.jup.ag/token/${mint}`,
  `https://lite-api.jup.ag/tokens/v1/token/${mint}`,
];

export interface SplTokenInfo {
  mint: string;
  decimals: number;
  symbol?: string;
  name?: string;
  logo?: string;
}

const SOLANA_BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isValidSolanaAddress(address: string): boolean {
  return SOLANA_BASE58_RE.test((address ?? "").trim());
}

async function fetchJupiterMeta(mint: string): Promise<Partial<SplTokenInfo>> {
  for (const url of JUP_META_URLS(mint)) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const j = await res.json();
      return {
        symbol: j?.symbol,
        name: j?.name,
        logo: j?.logoURI ?? j?.logo_uri,
        decimals: typeof j?.decimals === "number" ? j.decimals : undefined,
      };
    } catch {
      // try next
    }
  }
  return {};
}

// Base64 → Uint8Array without needing Buffer.
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Reads the SPL mint account and returns its decimals.
// Layout: mint_authority (36) + supply (8) + decimals (1) + is_initialized (1) + freeze_authority (36).
async function fetchMintDecimalsOnChain(mint: string): Promise<number | undefined> {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "getAccountInfo",
    params: [mint, { encoding: "base64", commitment: "confirmed" }],
  });
  for (const url of RPC_URLS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      if (!res.ok) continue;
      const j = await res.json();
      const value = j?.result?.value;
      if (!value || !Array.isArray(value.data)) continue;
      const [dataB64, encoding] = value.data;
      if (encoding !== "base64" || typeof dataB64 !== "string") continue;
      const bytes = b64ToBytes(dataB64);
      if (bytes.length < 82) continue; // not a mint account
      const decimals = bytes[44];
      if (typeof decimals === "number" && decimals >= 0 && decimals <= 18) return decimals;
    } catch {
      // try next
    }
  }
  return undefined;
}

export async function lookupToken(mint: string): Promise<SplTokenInfo> {
  const trimmed = (mint ?? "").trim();
  if (!trimmed) throw new Error("Informe o endereço do token (mint).");
  if (!isValidSolanaAddress(trimmed)) throw new Error("Endereço de mint inválido.");

  // Kick off both lookups in parallel; either can provide decimals.
  await ensureSolanaBufferPolyfill();
  const [meta, chainDecimals] = await Promise.all([
    fetchJupiterMeta(trimmed),
    fetchMintDecimalsOnChain(trimmed),
  ]);

  const decimals =
    typeof chainDecimals === "number"
      ? chainDecimals
      : typeof meta.decimals === "number"
      ? meta.decimals
      : undefined;

  if (decimals === undefined) {
    throw new Error(
      "Não foi possível ler esse mint on-chain. Confira o endereço e tente novamente em instantes.",
    );
  }

  return {
    mint: trimmed,
    decimals,
    symbol: meta.symbol,
    name: meta.name,
    logo: meta.logo,
  };
}
