// Client-only. Looks up metadata for ANY SPL token mint on Solana (not just
// tokens created on this site), so bounties/streams can use any existing token.
export const SOLANA_RPC = "https://api.mainnet-beta.solana.com";

let _web3: any | undefined;
async function loadWeb3(): Promise<any> {
  if (import.meta.env.SSR) throw new Error("Solana libs are browser-only");
  if (_web3) return _web3;
  _web3 = await import("@solana/web3.js");
  return _web3;
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

  const { Connection, PublicKey } = await loadWeb3();
  let mintPk: any;
  try {
    mintPk = new PublicKey(trimmed);
  } catch {
    throw new Error("Endereço de token inválido.");
  }

  const conn = new Connection(SOLANA_RPC, "confirmed");
  const accountInfo = await conn.getParsedAccountInfo(mintPk);
  const parsed = (accountInfo?.value?.data as any)?.parsed;
  if (!parsed || parsed.type !== "mint") {
    throw new Error("Esse endereço não corresponde a um token SPL válido na Solana.");
  }
  const decimals: number = parsed.info.decimals;

  const meta = await fetchJupiterMeta(trimmed);

  return {
    mint: trimmed,
    decimals,
    symbol: meta?.symbol ?? null,
    name: meta?.name ?? null,
    logoURI: meta?.logoURI ?? null,
  };
}

export async function getSplBalance(ownerBase58: string, mintAddress: string): Promise<number> {
  const { Connection, PublicKey } = await loadWeb3();
  const spl = await import("@solana/spl-token");
  const conn = new Connection(SOLANA_RPC, "confirmed");
  const mintPk = new PublicKey(mintAddress);
  const ownerPk = new PublicKey(ownerBase58);
  const ata = spl.getAssociatedTokenAddressSync(mintPk, ownerPk, true);
  try {
    const acct = await spl.getAccount(conn, ata);
    const mintInfo = await spl.getMint(conn, mintPk);
    return Number(acct.amount) / 10 ** mintInfo.decimals;
  } catch (e: any) {
    if (String(e?.message ?? "").includes("TokenAccountNotFound")) return 0;
    throw e;
  }
}

/**
 * Builds (unsigned) a transaction transferring `amount` of `mintAddress`
 * from the connected wallet to `toBase58`, creating the destination's
 * associated token account if needed. Caller signs & sends.
 */
export async function buildSplTransferTx(
  fromBase58: string,
  toBase58: string,
  mintAddress: string,
  amount: number,
  decimals: number,
): Promise<any> {
  const { Connection, PublicKey, Transaction } = await loadWeb3();
  const spl = await import("@solana/spl-token");
  const conn = new Connection(SOLANA_RPC, "confirmed");
  const mintPk = new PublicKey(mintAddress);
  const fromPk = new PublicKey(fromBase58);
  const toPk = new PublicKey(toBase58);

  const fromAta = spl.getAssociatedTokenAddressSync(mintPk, fromPk, true);
  const toAta = spl.getAssociatedTokenAddressSync(mintPk, toPk, true);

  const tx = new Transaction();
  const toAtaInfo = await conn.getAccountInfo(toAta);
  if (!toAtaInfo) {
    tx.add(
      spl.createAssociatedTokenAccountInstruction(fromPk, toAta, toPk, mintPk),
    );
  }
  const raw = BigInt(Math.round(amount * 10 ** decimals));
  tx.add(spl.createTransferCheckedInstruction(fromAta, mintPk, toAta, fromPk, raw, decimals));

  const { blockhash } = await conn.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = fromPk;
  return tx;
}
