import { ensureSolanaBufferPolyfill } from "./solana-buffer-polyfill";

export const VERIFICATION_MINT = "XhHLJpJtEHJucpYpAti2JvNs6eYsjeuFjRj9wvvaLDL";
export const BURN_AMOUNT = 3000;
const RPC_URL = "https://api.mainnet-beta.solana.com";

export type WalletKind = "phantom" | "solflare" | "backpack";

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

function getProvider(kind: WalletKind): any {
  if (typeof window === "undefined") throw new Error("Browser only");
  const w = window as any;
  if (kind === "phantom") {
    const p = w.phantom?.solana ?? (w.solana?.isPhantom ? w.solana : null);
    if (!p) throw new Error("Phantom não encontrada. Instale a extensão.");
    return p;
  }
  if (kind === "solflare") {
    const p = w.solflare;
    if (!p) throw new Error("Solflare não encontrada. Instale a extensão.");
    return p;
  }
  if (kind === "backpack") {
    const p = w.backpack?.solana ?? w.xnft?.solana;
    if (!p) throw new Error("Backpack não encontrada. Instale a extensão.");
    return p;
  }
  throw new Error("Carteira não suportada");
}

export async function connectWallet(kind: WalletKind): Promise<{
  provider: any;
  publicKeyStr: string;
}> {
  const provider = getProvider(kind);
  const resp = await provider.connect();
  const publicKeyStr =
    resp?.publicKey?.toString?.() ??
    provider.publicKey?.toString?.() ??
    "";
  if (!publicKeyStr) throw new Error("Não foi possível obter a chave pública");
  return { provider, publicKeyStr };
}

export async function getTokenBalance(walletAddress: string): Promise<number> {
  const { Connection, PublicKey } = await loadWeb3();
  const conn = new Connection(RPC_URL, "confirmed");
  const owner = new PublicKey(walletAddress);
  const mint = new PublicKey(VERIFICATION_MINT);
  const res = await conn.getParsedTokenAccountsByOwner(owner, { mint });
  let total = 0;
  for (const acc of res.value) {
    const amt = acc.account.data.parsed?.info?.tokenAmount?.uiAmount;
    if (typeof amt === "number") total += amt;
  }
  return total;
}

export async function burnTokens(
  provider: any,
  walletAddress: string,
): Promise<string> {
  const { Connection, PublicKey, Transaction } = await loadWeb3();
  const {
    getAssociatedTokenAddress,
    createBurnCheckedInstruction,
    getMint,
  } = await loadSpl();

  const conn = new Connection(RPC_URL, "confirmed");
  const owner = new PublicKey(walletAddress);
  const mint = new PublicKey(VERIFICATION_MINT);

  const mintInfo = await getMint(conn, mint);
  const decimals: number = mintInfo.decimals;
  const ata = await getAssociatedTokenAddress(mint, owner);
  const amount = BigInt(BURN_AMOUNT) * BigInt(10) ** BigInt(decimals);

  const ix = createBurnCheckedInstruction(
    ata,
    mint,
    owner,
    amount,
    decimals,
  );

  const tx = new Transaction().add(ix);
  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = owner;

  const signed = await provider.signAndSendTransaction(tx);
  const signature: string = signed?.signature ?? signed;
  await conn.confirmTransaction(signature, "confirmed");
  return signature;
}
