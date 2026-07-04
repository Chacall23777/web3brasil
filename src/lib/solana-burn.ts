// Client-only. Imports @solana packages from esm.sh at runtime with a
// @vite-ignore hint so the SSR (Cloudflare Worker) bundle never tries to
// resolve them — @solana/codecs has no workerd export condition.
export const SOLANA_RPC = "https://api.mainnet-beta.solana.com";
export const VERIFICATION_MINT = "XhHLJpJtEHJucpYpAti2JvNs6eYsjeuFjRj9wvvaLDL";
export const BURN_AMOUNT = 3000;

const WEB3_URL = "https://esm.sh/@solana/web3.js@1.98.4";
const SPL_URL = "https://esm.sh/@solana/spl-token@0.4.14?deps=@solana/web3.js@1.98.4";

let _web3: any | undefined;
let _spl: any | undefined;
async function loadWeb3(): Promise<any> {
  if (_web3) return _web3;
  _web3 = await import(/* @vite-ignore */ WEB3_URL);
  return _web3;
}
async function loadSpl(): Promise<any> {
  if (_spl) return _spl;
  _spl = await import(/* @vite-ignore */ SPL_URL);
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

async function withRetry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
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
    const [mintInfo, acct] = await Promise.all([
      withRetry(() => getMint(conn, mintPk)),
      withRetry(() => getAccount(conn, ata)),
    ]);
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
