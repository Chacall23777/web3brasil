// Client-only. Looks up metadata for ANY SPL token mint on Solana (not just
// tokens created on this site), so bounties/streams can use any existing token.
export const SOLANA_RPC = "https://api.mainnet-beta.solana.com";

// The public mainnet-beta RPC is heavily rate-limited and frequently
// rejects/times out requests coming straight from a browser. Fall back to
// other public endpoints so a single provider hiccup doesn't break lookups.
const RPC_FALLBACKS = [
  SOLANA_RPC,
  "https://solana-rpc.publicnode.com",
  "https://rpc.ankr.com/solana",
];

let _web3: any | undefined;
async function loadWeb3(): Promise<any> {
  if (import.meta.env.SSR) throw new Error("Solana libs are browser-only");
  if (_web3) return _web3;
  _web3 = await import("@solana/web3.js");
  return _web3;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * Fetches the parsed mint account, trying each fallback RPC in turn.
 * Throws a descriptive error only after every endpoint has failed.
 */
async function getMintAccountInfo(mintPk: any): Promise<any> {
  const { Connection } = await loadWeb3();
  let lastErr: unknown;
  for (const url of RPC_FALLBACKS) {
    try {
      const conn = new Connection(url, "confirmed");
      return await withTimeout(conn.getParsedAccountInfo(mintPk), 8000);
    } catch (e) {
      lastErr = e;
    }
  }
  const detail = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(
    `Não foi possível consultar a Solana agora (todas as RPCs falharam: ${detail}). Tente de novo em alguns segundos.`,
  );
}

export type TokenInfo = {
  mint: string;
  decimals: number;
  symbol: string | null;
  name: string | null;
  logoURI: string | null;
};

// Jupiter's public token list/metadata API — covers essentially every SPL
// token that has ever traded, not just a curated allowlist.
async function fetchJupiterMeta(mint: string): Promise<Partial<TokenInfo> | null> {
  try {
    const res = await fetch(`https://lite-api.jup.ag/tokens/v1/token/${mint}`);
    if (!res.ok) return null;
    const j = await res.json();
    if (!j || !j.address) return null;
    return {
      symbol: j.symbol ?? null,
      name: j.name ?? null,
      logoURI: j.logoURI ?? null,
      decimals: typeof j.decimals === "number" ? j.decimals : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Validates that `mint` is a real SPL token mint on-chain and returns its
 * metadata. Throws a user-facing error message if invalid.
 */
export async function lookupToken(mintAddress: string): Promise<TokenInfo> {
  const trimmed = mintAddress.trim();
  if (!trimmed) throw new Error("Informe o endereço do token.");

  const { PublicKey } = await loadWeb3();
  let mintPk: any;
  try {
    mintPk = new
