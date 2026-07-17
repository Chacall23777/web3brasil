import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RPC_URLS = [
  "https://solana-rpc.publicnode.com",
  "https://api.mainnet-beta.solana.com",
  "https://rpc.ankr.com/solana",
  "https://solana.drpc.org",
  "https://mainnet.helius-rpc.com/?api-key=",
  "https://go.getblock.io/4136d34f90a6488b84214ae26f0ed5f4",
  "https://solana.blockdaemon.com",
];
const RPC_URL = RPC_URLS[0];

const BANNED_PATTERNS: RegExp[] = [
  /auto ?les[aã]o|se cortar|se machucar|suic[ií]dio/i,
  /matar|assassin|arma de fogo|explosivo/i,
  /nudez|pornogr[aá]fico|sexual expl[ií]cito/i,
  /maltratar animal|machucar (o |os )?(animal|cachorro|gato)/i,
  /ato ilegal|roubar|invadir sistema|hackear/i,
];

function containsBannedContent(text: string): boolean {
  return BANNED_PATTERNS.some((re) => re.test(text));
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

async function rpcCall(method: string, params: unknown[]): Promise<any> {
  const delays = [0, 400, 1000, 2000, 3500];
  const errors: string[] = [];
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
  for (const d of delays) {
    if (d) await new Promise((r) => setTimeout(r, d));
    for (const url of RPC_URLS) {
      try {
        const res = await fetchWithTimeout(
          url,
          { method: "POST", headers: { "content-type": "application/json" }, body },
          6000,
        );
        if (res.status === 429 || res.status >= 500 || res.status === 403 || res.status === 401) {
          errors.push(`${res.status} @ ${new URL(url).host}`);
          continue;
        }
        const j = await res.json();
        if (j.error) {
          errors.push(`${j.error?.message ?? "err"} @ ${new URL(url).host}`);
          continue;
        }
        return j.result;
      } catch (e: any) {
        errors.push(`${e?.name === "AbortError" ? "timeout" : e?.message ?? "fetch fail"} @ ${new URL(url).host}`);
      }
    }
  }
  const summary = Array.from(new Set(errors)).slice(0, 3).join(" | ");
  throw new Error(
    `RPC da Solana indisponível no momento (${summary || "sem detalhes"}). Aguarde alguns segundos e tente novamente.`,
  );
}



function decimalToRawUnits(value: number, decimals: number): bigint {
  const [whole, fraction = ""] = value.toFixed(decimals).split(".");
  const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
  return BigInt(`${whole || "0"}${paddedFraction || ""}`);
}

const TOKEN_PROGRAM_IDS = [
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", // SPL Token classic
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb", // Token-2022
];

async function getVaultTokenBalance(owner: string, mint: string): Promise<bigint> {
  let total = 0n;
  for (const programId of TOKEN_PROGRAM_IDS) {
    try {
      const result = await rpcCall("getTokenAccountsByOwner", [
        owner,
        { mint, programId },
        { encoding: "jsonParsed", commitment: "confirmed" },
      ]);
      const accounts: any[] = result?.value ?? [];
      for (const account of accounts) {
        const amount = account?.account?.data?.parsed?.info?.tokenAmount?.amount;
        if (amount) total += BigInt(amount);
      }
    } catch {
      // try next program
    }
  }
  return total;
}

export const createBounty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().trim().min(1).max(140),
        description: z.string().trim().min(1).max(4000),
        token_mint: z.string().trim().min(30).max(50),
        token_symbol: z.string().trim().max(20).nullable().optional(),
        token_name: z.string().trim().max(80).nullable().optional(),
        token_decimals: z.number().int().min(0).max(18),
        reward_amount: z.number().positive(),
        deadline: z.string().datetime().nullable().optional(),
        stream_url: z.string().trim().url().max(500).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (containsBannedContent(`${data.title} ${data.description}`)) {
      throw new Error(
        "Essa bounty parece envolver conteúdo proibido (autolesão, violência, conteúdo sexual explícito ou atos ilegais). Reformule a tarefa.",
      );
    }
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { Keypair } = await import("@solana/web3.js");

    const vault = Keypair.generate();
    const vaultAddress = vault.publicKey.toBase58();
    const vaultSecretKey = Buffer.from(vault.secretKey).toString("base64");

    const { data: bounty, error } = await (supabaseAdmin as any)
      .from("bounties")
      .insert({
        creator_id: userId,
        title: data.title,
        description: data.description,
        token_mint: data.token_mint,
        token_symbol: data.token_symbol ?? null,
        token_name: data.token_name ?? null,
        token_decimals: data.token_decimals,
        reward_amount: data.reward_amount,
        vault_address: vaultAddress,
        deadline: data.deadline ?? null,
        stream_url: data.stream_url ?? null,
        status: "awaiting_deposit",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: keyErr } = await (supabaseAdmin as any)
      .from("bounty_vault_keys")
      .insert({ bounty_id: bounty.id, vault_secret_key: vaultSecretKey });
    if (keyErr) throw new Error(keyErr.message);

    return { id: bounty.id, vault_address: vaultAddress };
  });

export const confirmBountyDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ bounty_id: z.string().uuid(), signature: z.string().trim().min(20).max(150).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: bounty, error: fetchErr } = await (supabaseAdmin as any)
      .from("bounties")
      .select("id, creator_id, token_mint, token_decimals, reward_amount, vault_address, status")
      .eq("id", data.bounty_id)
      .single();
    if (fetchErr || !bounty) throw new Error("Bounty não encontrada.");
    if (bounty.creator_id !== context.userId) throw new Error("Só o criador pode confirmar o depósito.");
    if (bounty.status !== "awaiting_deposit") throw new Error("Essa bounty não está aguardando depósito.");

    if (data.signature) {
      const tx = await rpcCall("getTransaction", [
        data.signature,
        { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" },
      ]);
      if (!tx) throw new Error("Transação não encontrada. Aguarde alguns instantes e tente novamente.");
      if (tx.meta?.err) throw new Error("A transação falhou on-chain.");
    }

    const expected = decimalToRawUnits(bounty.reward_amount, bounty.token_decimals);
    const current = await getVaultTokenBalance(bounty.vault_address, bounty.token_mint);
    if (current < expected) {
      const divisor = 10 ** bounty.token_decimals;
      const currentUi = Number(current) / divisor;
      const missingUi = Number(expected - current) / divisor;
      throw new Error(
        `Depósito ainda insuficiente: recebemos ${currentUi.toLocaleString("pt-BR")} ${bounty.token_symbol ?? "tokens"}, faltam ${missingUi.toLocaleString("pt-BR")}. Verifique se enviou o mesmo mint para o endereço do cofre.`,
      );
    }

    const { error } = await (supabaseAdmin as any)
      .from("bounties")
      .update({ status: "open", deposit_tx_signature: data.signature ?? null })
      .eq("id", bounty.id);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const submitBountyProof = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        bounty_id: z.string().uuid(),
        submitter_wallet: z.string().trim().min(30).max(50),
        proof_url: z.string().trim().url().max(1000),
        note: z.string().trim().max(2000).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: bounty } = await (supabaseAdmin as any)
      .from("bounties")
      .select("id, status")
      .eq("id", data.bounty_id)
      .single();
    if (!bounty) throw new Error("Bounty não encontrada.");
    if (bounty.status !== "open") throw new Error("Essa bounty não está aberta pra submissões.");

    const { error } = await (supabaseAdmin as any).from("bounty_submissions").insert({
      bounty_id: data.bounty_id,
      submitter_id: context.userId,
      submitter_wallet: data.submitter_wallet,
      proof_url: data.proof_url,
      note: data.note ?? null,
    });
    if (error) throw new Error(error.message);

    await (supabaseAdmin as any)
      .from("bounties")
      .update({ status: "under_review" })
      .eq("id", data.bounty_id);

    return { ok: true };
  });

async function payoutFromVault(
  bountyId: string,
  toBase58: string,
): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } = await import(
    "@solana/web3.js"
  );
  const spl = await import("@solana/spl-token");

  const [{ data: bounty }, { data: keyRow }] = await Promise.all([
    (supabaseAdmin as any)
      .from("bounties")
      .select("token_mint, token_decimals, reward_amount, vault_address")
      .eq("id", bountyId)
      .single(),
    (supabaseAdmin as any)
      .from("bounty_vault_keys")
      .select("vault_secret_key")
      .eq("bounty_id", bountyId)
      .single(),
  ]);
  if (!bounty || !keyRow) throw new Error("Cofre da bounty não encontrado.");

  const secretKey = Buffer.from(keyRow.vault_secret_key, "base64");
  const vaultKeypair = Keypair.fromSecretKey(secretKey);
  const conn = new Connection(RPC_URL, "confirmed");

  const mintPk = new PublicKey(bounty.token_mint);
  const toPk = new PublicKey(toBase58);

  // Detect token program (classic SPL vs Token-2022) from the mint account owner.
  const mintInfo = await conn.getAccountInfo(mintPk);
  if (!mintInfo) throw new Error("Mint não encontrado on-chain.");
  const tokenProgramId = mintInfo.owner;

  const fromAta = spl.getAssociatedTokenAddressSync(
    mintPk,
    vaultKeypair.publicKey,
    true,
    tokenProgramId,
  );
  const toAta = spl.getAssociatedTokenAddressSync(mintPk, toPk, true, tokenProgramId);

  const tx = new Transaction();
  const toAtaInfo = await conn.getAccountInfo(toAta);
  if (!toAtaInfo) {
    tx.add(
      spl.createAssociatedTokenAccountInstruction(
        vaultKeypair.publicKey,
        toAta,
        toPk,
        mintPk,
        tokenProgramId,
      ),
    );
  }
  const raw = BigInt(Math.round(bounty.reward_amount * 10 ** bounty.token_decimals));
  tx.add(
    spl.createTransferCheckedInstruction(
      fromAta,
      mintPk,
      toAta,
      vaultKeypair.publicKey,
      raw,
      bounty.token_decimals,
      [],
      tokenProgramId,
    ),
  );

  const sig = await sendAndConfirmTransaction(conn, tx, [vaultKeypair], { commitment: "confirmed" });
  return sig;
}

export const reviewBountySubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        submission_id: z.string().uuid(),
        decision: z.enum(["approve", "reject"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: submission } = await (supabaseAdmin as any)
      .from("bounty_submissions")
      .select("id, bounty_id, submitter_wallet, status")
      .eq("id", data.submission_id)
      .single();
    if (!submission) throw new Error("Submissão não encontrada.");
    if (submission.status !== "pending") throw new Error("Essa submissão já foi revisada.");

    const { data: bounty } = await (supabaseAdmin as any)
      .from("bounties")
      .select("id, creator_id, status")
      .eq("id", submission.bounty_id)
      .single();
    if (!bounty) throw new Error("Bounty não encontrada.");
    if (bounty.creator_id !== context.userId) throw new Error("Só o criador da bounty pode revisar.");

    if (data.decision === "reject") {
      await (supabaseAdmin as any)
        .from("bounty_submissions")
        .update({ status: "rejected", reviewed_at: new Date().toISOString() })
        .eq("id", data.submission_id);
      await (supabaseAdmin as any).from("bounties").update({ status: "open" }).eq("id", bounty.id);
      return { ok: true };
    }

    const sig = await payoutFromVault(bounty.id, submission.submitter_wallet);

    await (supabaseAdmin as any)
      .from("bounty_submissions")
      .update({ status: "approved", reviewed_at: new Date().toISOString(), payout_tx_signature: sig })
      .eq("id", data.submission_id);
    await (supabaseAdmin as any).from("bounties").update({ status: "completed" }).eq("id", bounty.id);

    return { ok: true, signature: sig };
  });

export const refundBounty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ bounty_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: bounty } = await (supabaseAdmin as any)
      .from("bounties")
      .select("id, creator_id, status")
      .eq("id", data.bounty_id)
      .single();
    if (!bounty) throw new Error("Bounty não encontrada.");
    if (bounty.creator_id !== context.userId) throw new Error("Só o criador pode cancelar.");
    if (!["open", "under_review"].includes(bounty.status)) {
      throw new Error("Essa bounty não pode ser cancelada nesse estado.");
    }

    const { data: creatorProfile } = await (supabaseAdmin as any)
      .from("profiles")
      .select("solana_wallet")
      .eq("id", context.userId)
      .single();
    if (!creatorProfile?.solana_wallet) {
      throw new Error("Conecte e salve sua carteira Solana no perfil antes de cancelar.");
    }

    const sig = await payoutFromVault(bounty.id, creatorProfile.solana_wallet);

    await (supabaseAdmin as any)
      .from("bounties")
      .update({ status: "refunded" })
      .eq("id", bounty.id);

    return { ok: true, signature: sig };
  });
