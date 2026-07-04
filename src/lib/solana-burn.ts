// Client-only. Solana wallet/token libs are bundled from npm (lockfile-pinned)
// and lazy-loaded via dynamic import so the SSR/Worker bundle DCEs the branch
// (import.meta.env.SSR is a compile-time constant).
export const SOLANA_RPC = "https://api.mainnet-beta.solana.com";
export const VERIFICATION_MINT = "XhHLJpJtEHJucpYpAti2JvNs6eYsjeuFjRj9wvvaLDL";
export const BURN_AMOUNT = 3000;

let _web3: any | undefined;
let _spl: any | undefined;
async function loadWeb3(): Promise<any> {
  if (import.meta.env.SSR) throw new Error("Solana libs are browser-only");
  if (_web3) return _web3;
  _web3 = await import("@solana/web3.js");
  return _web3;
}
async function loadSpl(): Promise<any> {
  if (import.meta.env.SSR) throw new Error("Solana libs are browser-only");
  if (_spl) return _spl;
  _spl = await import("@solana/spl-token");
  return _spl;
}

export type WalletKind = "phantom" | "solflare" | "backpack";

export function detectWallet(kind: WalletKind): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  if (kind === "phantom") return w.phantom?.solana ?? (w.solana?.isPhantom ? w.solana : null);
  if (kind === "solflare") return w.solflare ?? null;
  if (kind === "backpack") return w.backpack?.solana ?? w.xnft?.solana ?? null;
  return null;
}

export async function connectWallet(
  kind: WalletKind,
): Promise<{ provider: any; publicKeyStr: string }> {
  const provider = detectWallet(kind);
  if (!provider) {
    const urls: Record<WalletKind, string> = {
      phantom: "https://phantom.app/",
      solflare: "https://solflare.com/",
      backpack: "https://backpack.app/",
    };
    throw new Error(`Carteira ${kind} não detectada. Instale em ${urls[kind]}`);
  }
  const { PublicKey } = await loadWeb3();
  const resp = await provider.connect();
  const pk = resp?.publicKey ?? provider.publicKey;
  if (!pk) throw new Error("Não foi possível conectar à carteira.");
  const publicKeyStr = new PublicKey(pk.toString()).toBase58();
  return { provider, publicKeyStr };
}

async function withRetry(fn: () => Promise<any>, tries = 4): Promise<any> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    if (i) await new Promise((r) => setTimeout(r, 700 * i));
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(
    "RPC público da Solana indisponível ou limitando requisições. Aguarde alguns instantes e tente novamente.",
  );
}

export async function getTokenBalance(ownerBase58: string): Promise<number> {
  const { Connection, PublicKey } = await loadWeb3();
  const { getAssociatedTokenAddressSync, getAccount, getMint } = await loadSpl();
  const conn = new Connection(SOLANA_RPC, "confirmed");
  const mintPk = new PublicKey(VERIFICATION_MINT);
  const ownerPk = new PublicKey(ownerBase58);
  const ata = getAssociatedTokenAddressSync(mintPk, ownerPk, true);
  try {
    const [mintInfo, acct] = (await Promise.all([
      withRetry(() => getMint(conn, mintPk)),
      withRetry(() => getAccount(conn, ata)),
    ])) as [any, any];
    return Number(acct.amount) / 10 ** mintInfo.decimals;
  } catch (e: any) {
    if (String(e?.message ?? "").includes("TokenAccountNotFound")) return 0;
    throw e;
  }
}

export async function burnTokens(provider: any, ownerBase58: string): Promise<string> {
  const { Connection, PublicKey, Transaction } = await loadWeb3();
  const { createBurnCheckedInstruction, getAssociatedTokenAddressSync, getMint } = await loadSpl();
  const conn = new Connection(SOLANA_RPC, "confirmed");
  const mintPk = new PublicKey(VERIFICATION_MINT);
  const ownerPk = new PublicKey(ownerBase58);
  const ata = getAssociatedTokenAddressSync(mintPk, ownerPk, true);
  const mintInfo = await withRetry(() => getMint(conn, mintPk));
  const raw = BigInt(BURN_AMOUNT) * BigInt(10) ** BigInt(mintInfo.decimals);

  const ix = createBurnCheckedInstruction(ata, mintPk, ownerPk, raw, mintInfo.decimals);
  const tx = new Transaction().add(ix);
  const { blockhash, lastValidBlockHeight } = await withRetry(() =>
    conn.getLatestBlockhash("confirmed"),
  );
  tx.recentBlockhash = blockhash;
  tx.feePayer = ownerPk;

  const signed = await provider.signTransaction(tx);
  const sig = await withRetry(() =>
    conn.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 }),
  );
  await withRetry(() =>
    conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed"),
  );
  return sig;
}
