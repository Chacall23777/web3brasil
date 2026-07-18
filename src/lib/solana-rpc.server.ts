// Single source of truth for Solana JSON-RPC access from server functions.
// Handles: provider fallback, exponential backoff, per-provider timeouts,
// structured logging, PublicKey/signature validation, and friendly errors.
//
// Server-only: never import from client bundles or *.functions.ts top-level.
// Load inside a handler:
//   const { rpcCall, verifyDepositTransaction } = await import("@/lib/solana-rpc.server");

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;

export class SolanaRpcError extends Error {
  friendly: string;
  cause?: unknown;
  constructor(friendly: string, technical?: string, cause?: unknown) {
    super(technical || friendly);
    this.friendly = friendly;
    this.cause = cause;
    this.name = "SolanaRpcError";
  }
}

export function isValidPublicKey(value: string): boolean {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (v.length < 32 || v.length > 44) return false;
  return BASE58_RE.test(v);
}

export function assertValidPublicKey(value: string, label = "endereço"): string {
  const v = (value ?? "").trim();
  if (!isValidPublicKey(v)) {
    throw new SolanaRpcError(
      `O ${label} informado não é uma chave pública Solana válida.`,
      `invalid publickey: ${label}=${JSON.stringify(value)}`,
    );
  }
  return v;
}

export function isValidSignature(value: string): boolean {
  if (typeof value !== "string") return false;
  const v = value.trim();
  // Solana signatures are 64-byte ed25519, base58-encoded → typically 87-88 chars
  if (v.length < 64 || v.length > 100) return false;
  return BASE58_RE.test(v);
}

export function assertValidSignature(value: string): string {
  const v = (value ?? "").trim();
  if (!isValidSignature(v)) {
    throw new SolanaRpcError(
      "A assinatura da transação informada é inválida.",
      `invalid signature=${JSON.stringify(value)}`,
    );
  }
  return v;
}

type Provider = { name: string; url: string; weight: number };

function buildProviders(): Provider[] {
  const env = (name: string) => (typeof process !== "undefined" ? process.env?.[name] : undefined);
  const list: Provider[] = [];
  const helius = env("HELIUS_RPC_URL") || (env("HELIUS_API_KEY") ? `https://mainnet.helius-rpc.com/?api-key=${env("HELIUS_API_KEY")}` : undefined);
  const quicknode = env("QUICKNODE_RPC_URL");
  const triton = env("TRITON_RPC_URL");
  const custom = env("SOLANA_RPC_URL");
  if (helius) list.push({ name: "helius", url: helius, weight: 100 });
  if (quicknode) list.push({ name: "quicknode", url: quicknode, weight: 90 });
  if (triton) list.push({ name: "triton", url: triton, weight: 90 });
  if (custom) list.push({ name: "custom", url: custom, weight: 80 });
  // Public fallbacks (rate-limited, use last).
  list.push(
    { name: "publicnode", url: "https://solana-rpc.publicnode.com", weight: 40 },
    { name: "ankr", url: "https://rpc.ankr.com/solana", weight: 30 },
    { name: "drpc", url: "https://solana.drpc.org", weight: 30 },
    { name: "mainnet-beta", url: "https://api.mainnet-beta.solana.com", weight: 20 },
  );
  return list;
}

// Cache providers per module instance (worker-scoped).
let _providers: Provider[] | null = null;
function providers(): Provider[] {
  if (!_providers) _providers = buildProviders();
  return _providers;
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

type RpcOpts = {
  timeoutMs?: number;
  attempts?: number;
  // If true, a JSON-RPC error result is returned instead of throwing (used
  // for methods where "not found" is a legitimate outcome, e.g. getTransaction).
  allowResultError?: boolean;
};

function hostOf(url: string): string {
  try { return new URL(url).host; } catch { return url; }
}

function log(event: string, data: Record<string, unknown>) {
  try {
    // Structured, single-line JSON log for easy grep in server logs.
    console.log(`[solana-rpc] ${event}`, JSON.stringify(data));
  } catch {
    console.log(`[solana-rpc] ${event}`, data);
  }
}

export async function rpcCall<T = any>(method: string, params: unknown[], opts: RpcOpts = {}): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? 7000;
  const attempts = Math.max(1, opts.attempts ?? 4);
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
  const errors: string[] = [];
  const started = Date.now();

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) {
      const backoff = Math.min(4000, 250 * 2 ** (attempt - 1)) + Math.floor(Math.random() * 150);
      await new Promise((r) => setTimeout(r, backoff));
    }
    for (const p of providers()) {
      const t0 = Date.now();
      try {
        const res = await fetchWithTimeout(
          p.url,
          { method: "POST", headers: { "content-type": "application/json" }, body },
          timeoutMs,
        );
        const durMs = Date.now() - t0;
        if (!res.ok) {
          // 401/403/429/5xx → rotate provider. 403 is common on public RPCs
          // that block certain methods (e.g. getProgramAccounts); skip provider.
          const bodyText = await res.text().catch(() => "");
          errors.push(`${res.status} ${p.name} ${durMs}ms`);
          log("http_error", { method, provider: p.name, status: res.status, durMs, body: bodyText.slice(0, 200) });
          continue;
        }
        const j: any = await res.json();
        if (j.error) {
          const msg = String(j.error?.message ?? "rpc error");
          errors.push(`${p.name}: ${msg}`);
          log("rpc_error", { method, provider: p.name, durMs, code: j.error?.code, message: msg });
          if (opts.allowResultError) return j as T;
          // "WrongSize" or "Invalid param" → caller passed bad args; do not retry.
          if (/WrongSize|Invalid param|Invalid public key|Invalid signature/i.test(msg)) {
            throw new SolanaRpcError(
              "Parâmetro inválido enviado à Solana. Verifique o endereço/assinatura.",
              `rpc invalid param on ${p.name}: ${msg}`,
            );
          }
          continue;
        }
        log("ok", { method, provider: p.name, durMs, totalMs: Date.now() - started });
        return j.result as T;
      } catch (e: any) {
        if (e instanceof SolanaRpcError) throw e;
        const durMs = Date.now() - t0;
        const label = e?.name === "AbortError" ? "timeout" : (e?.message ?? "fetch fail");
        errors.push(`${p.name}: ${label} ${durMs}ms`);
        log("fetch_error", { method, provider: p.name, durMs, error: label, stack: e?.stack?.split("\n").slice(0, 3).join(" | ") });
      }
    }
  }

  const summary = Array.from(new Set(errors)).slice(0, 4).join(" | ");
  log("all_failed", { method, totalMs: Date.now() - started, errors: summary });
  throw new SolanaRpcError(
    "Não conseguimos falar com a rede Solana agora. Aguarde alguns segundos e tente de novo.",
    `all providers failed for ${method}: ${summary}`,
  );
}

// SPL Token + Token-2022 program IDs.
const TOKEN_PROGRAM_IDS = [
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
];

export async function getVaultTokenBalance(owner: string, mint: string): Promise<bigint> {
  assertValidPublicKey(owner, "endereço do cofre");
  assertValidPublicKey(mint, "endereço do mint");
  let total = 0n;
  for (const programId of TOKEN_PROGRAM_IDS) {
    try {
      const result: any = await rpcCall("getTokenAccountsByOwner", [
        owner,
        { mint, programId },
        { encoding: "jsonParsed", commitment: "confirmed" },
      ]);
      const accounts: any[] = result?.value ?? [];
      for (const a of accounts) {
        const amount = a?.account?.data?.parsed?.info?.tokenAmount?.amount;
        if (amount) total += BigInt(amount);
      }
    } catch (e) {
      // Try next program; only rethrow if it's a hard param error.
      if (e instanceof SolanaRpcError && /inválido/i.test(e.friendly)) throw e;
    }
  }
  return total;
}

export type DepositVerification = {
  ok: true;
  amountRaw: bigint;
  slot: number;
  signature: string;
};

// Verifies a specific deposit transaction sent to the vault.
// - Confirms tx exists and is finalized (or at least confirmed with no error).
// - Confirms one of the token balance deltas increments the vault's ATA
//   for the expected mint by at least `expectedRaw`.
export async function verifyDepositTransaction(params: {
  signature: string;
  vault: string;
  mint: string;
  expectedRaw: bigint;
}): Promise<DepositVerification> {
  const signature = assertValidSignature(params.signature);
  const vault = assertValidPublicKey(params.vault, "endereço do cofre");
  const mint = assertValidPublicKey(params.mint, "endereço do mint");

  const tx: any = await rpcCall(
    "getTransaction",
    [signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "finalized" }],
    { allowResultError: true, attempts: 5 },
  );

  // allowResultError may return the raw envelope on error
  const result = tx && typeof tx === "object" && "result" in tx ? (tx as any).result : tx;

  if (!result) {
    throw new SolanaRpcError(
      "Ainda não conseguimos ver essa transação na rede. Aguarde a finalização (30–60s) e tente de novo.",
      `getTransaction returned null for ${signature}`,
    );
  }
  if (result.meta?.err) {
    throw new SolanaRpcError(
      "A transação informada falhou on-chain. Envie um novo depósito.",
      `tx failed: ${JSON.stringify(result.meta.err)}`,
    );
  }

  const pre: any[] = result.meta?.preTokenBalances ?? [];
  const post: any[] = result.meta?.postTokenBalances ?? [];
  const accountKeys: any[] = result.transaction?.message?.accountKeys ?? [];
  const keyAt = (i: number) => {
    const k = accountKeys[i];
    return typeof k === "string" ? k : k?.pubkey;
  };

  // Find post-balance for vault owner + mint.
  let delta = 0n;
  for (const pb of post) {
    if (pb.mint !== mint) continue;
    if (pb.owner !== vault) continue;
    const postAmt = BigInt(pb.uiTokenAmount?.amount ?? "0");
    const match = pre.find(
      (x) => x.accountIndex === pb.accountIndex && x.mint === pb.mint && x.owner === pb.owner,
    );
    const preAmt = BigInt(match?.uiTokenAmount?.amount ?? "0");
    const d = postAmt - preAmt;
    if (d > delta) delta = d;
    // touching keyAt just to keep it referenced for debugging logs below
    keyAt(pb.accountIndex);
  }

  if (delta < params.expectedRaw) {
    throw new SolanaRpcError(
      "Essa transação não creditou o valor esperado no cofre. Confira mint, destinatário e valor.",
      `deposit delta ${delta} < expected ${params.expectedRaw} for vault=${vault} mint=${mint}`,
    );
  }

  return { ok: true, amountRaw: delta, slot: result.slot ?? 0, signature };
}
