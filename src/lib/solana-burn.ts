import {
  Connection,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  createBurnCheckedInstruction,
  getAssociatedTokenAddressSync,
  getAccount,
  getMint,
} from "@solana/spl-token";

export const SOLANA_RPC = "https://api.mainnet-beta.solana.com";
export const VERIFICATION_MINT = "XhHLJpJtEHJucpYpAti2JvNs6eYsjeuFjRj9wvvaLDL";
export const BURN_AMOUNT = 3000;

export type SolanaProvider = {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  connect: () => Promise<{ publicKey: PublicKey }>;
};

export type WalletKind = "phantom" | "solflare" | "backpack";

export function detectWallet(kind: WalletKind): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  if (kind === "phantom") return w.phantom?.solana ?? (w.solana?.isPhantom ? w.solana : null);
  if (kind === "solflare") return w.solflare ?? null;
  if (kind === "backpack") return w.backpack?.solana ?? w.xnft?.solana ?? null;
  return null;
}

export async function connectWallet(kind: WalletKind): Promise<{ provider: any; publicKey: PublicKey }> {
  const provider = detectWallet(kind);
  if (!provider) {
    const urls: Record<WalletKind, string> = {
      phantom: "https://phantom.app/",
      solflare: "https://solflare.com/",
      backpack: "https://backpack.app/",
    };
    throw new Error(`Carteira ${kind} não detectada. Instale em ${urls[kind]}`);
  }
  const resp = await provider.connect();
  const pk = resp?.publicKey ?? provider.publicKey;
  if (!pk) throw new Error("Não foi possível conectar à carteira.");
  return { provider, publicKey: new PublicKey(pk.toString()) };
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

export async function getTokenBalance(owner: PublicKey): Promise<number> {
  const conn = new Connection(SOLANA_RPC, "confirmed");
  const mintPk = new PublicKey(VERIFICATION_MINT);
  const ata = getAssociatedTokenAddressSync(mintPk, owner, true);
  try {
    const [mintInfo, acct] = await Promise.all([
      withRetry(() => getMint(conn, mintPk)),
      withRetry(() => getAccount(conn, ata)),
    ]);
    return Number(acct.amount) / 10 ** mintInfo.decimals;
  } catch (e: any) {
    // TokenAccountNotFound -> zero balance
    if (String(e?.message ?? "").includes("TokenAccountNotFound")) return 0;
    throw e;
  }
}

export async function burnTokens(provider: any, owner: PublicKey): Promise<string> {
  const conn = new Connection(SOLANA_RPC, "confirmed");
  const mintPk = new PublicKey(VERIFICATION_MINT);
  const ata = getAssociatedTokenAddressSync(mintPk, owner, true);
  const mintInfo = await withRetry(() => getMint(conn, mintPk));
  const raw = BigInt(BURN_AMOUNT) * BigInt(10) ** BigInt(mintInfo.decimals);

  const ix = createBurnCheckedInstruction(ata, mintPk, owner, raw, mintInfo.decimals);
  const tx = new Transaction().add(ix);
  const { blockhash, lastValidBlockHeight } = await withRetry(() => conn.getLatestBlockhash("confirmed"));
  tx.recentBlockhash = blockhash;
  tx.feePayer = owner;

  const signed = await provider.signTransaction(tx);
  const sig = await withRetry(() =>
    conn.sendRawTransaction(signed.serialize(), { skipPreflight: false, maxRetries: 3 }),
  );
  await withRetry(() =>
    conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed"),
  );
  return sig;
}
