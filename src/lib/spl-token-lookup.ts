import { ensureSolanaBufferPolyfill } from "./solana-buffer-polyfill";

const RPC_URLS = [
  "https://solana-rpc.publicnode.com",
  "https://rpc.ankr.com/solana",
  "https://api.mainnet-beta.solana.com",
];

let _web3: any | undefined;
let _spl: any | undefined;

async function loadWeb3(): Promise<any> {
  if (import.meta.env.SSR) throw new Error("Solana libs are browser-only");
  await ensureSolanaBufferPolyfill();
  if (_web3) return _web3;
  _web3 = await import("@solana/web3.js");
  return _web3;
}

async function loadSpl(): Promise<any> {
  if (import.meta.env.SSR) throw new Error("Solana libs are browser-only");
  await ensureSolanaBufferPolyfill();
  if (_spl) return _spl;
  _spl = await import("@solana/spl-token");
  return _spl;
}

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
  try {
    const res = await fetch(`https://tokens.jup.ag/token/${mint}`);
    if (!res.ok) return {};
    const j = await res.json();
    return {
      symbol: j?.symbol,
      name: j?.name,
      logo: j?.logoURI,
    };
  } catch {
    return {};
  }
}

export async function lookupToken(mint: string): Promise<SplTokenInfo> {
  const trimmed = (mint ?? "").trim();
  if (!trimmed) throw new Error("Informe o endereço do token (mint).");

  const { Connection, PublicKey } = await loadWeb3();
  const { getMint } = await loadSpl();

  let mintPk: any;
  try {
    mintPk = new PublicKey(trimmed);
  } catch {
    throw new Error("Endereço de mint inválido.");
  }

  // Try Jupiter first (fast, no RPC needed, includes decimals + metadata)
  const meta = await fetchJupiterMeta(trimmed);
  const jupRes = await fetch(`https://tokens.jup.ag/token/${trimmed}`).catch(() => null);
  let decimals: number | undefined;
  if (jupRes && jupRes.ok) {
    try {
      const j = await jupRes.json();
      if (typeof j?.decimals === "number") decimals = j.decimals;
    } catch {}
  }

  // Fall back to on-chain lookup via multiple public RPCs
  if (decimals === undefined) {
    let lastErr: any;
    for (const url of RPC_URLS) {
      try {
        const conn = new Connection(url, "confirmed");
        const mintInfo = await getMint(conn, mintPk);
        decimals = mintInfo.decimals;
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (decimals === undefined) {
      throw new Error("Não foi possível ler o mint. Verifique o endereço.");
    }
  }

  return {
    mint: trimmed,
    decimals,
    symbol: meta.symbol,
    name: meta.name,
    logo: meta.logo,
  };
}
