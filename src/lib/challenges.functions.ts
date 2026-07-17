import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RPC_URLS = [
  "https://solana-rpc.publicnode.com",
  "https://api.mainnet-beta.solana.com",
  "https://rpc.ankr.com/solana",
  "https://solana.drpc.org",
];

async function rpcCall(method: string, params: unknown[]): Promise<any> {
  const delays = [0, 500, 1500];
  let lastErr: unknown;
  for (const d of delays) {
    if (d) await new Promise((r) => setTimeout(r, d));
    for (const url of RPC_URLS) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        });
        if (res.status === 429 || res.status >= 500) {
          lastErr = new Error(`RPC ${res.status}`);
          continue;
        }
        const j = await res.json();
        if (j.error) {
          lastErr = new Error(String(j.error?.message ?? ""));
          continue;
        }
        return j.result;
      } catch (e) {
        lastErr = e;
      }
    }
  }
  throw new Error("RPC da Solana indisponível no momento. Tente novamente em instantes.");
}

/** Reads the SPL token balance held by `owner` for `mint`, in base units (bigint). */
async function getEscrowBalance(owner: string, mint: string): Promise<bigint> {
  const result = await rpcCall("getTokenAccountsByOwner", [
    owner,
    { mint },
    { encoding: "jsonParsed", commitment: "confirmed" },
  ]);
  const accs: any[] = result?.value ?? [];
  let total = 0n;
  for (const a of accs) {
    const raw = a?.account?.data?.parsed?.info?.tokenAmount?.amount;
    if (raw) total += BigInt(raw);
  }
  return total;
}

// ---------- CREATE ----------
export const createChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().trim().min(3).max(140),
        description: z.string().trim().min(10).max(5000),
        cover_url: z.string().trim().url().max(1000).nullable().optional(),
        token_mint: z.string().trim().min(30).max(50),
        token_symbol: z.string().trim().max(20).nullable().optional(),
        token_name: z.string().trim().max(80).nullable().optional(),
        token_decimals: z.number().int().min(0).max(18),
        total_amount: z.number().positive(),
        winners_count: z.number().int().min(1).max(10000),
        rules_template: z.enum(["follow_x_comment", "post_hashtag", "answer_question", "custom"]),
        rules_json: z.record(z.any()).default({}),
        validation_mode: z.enum(["manual", "community"]),
        starts_at: z.string().datetime(),
        ends_at: z.string().datetime(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    if (new Date(data.ends_at) <= new Date(data.starts_at)) {
      throw new Error("A data de término precisa ser maior que a de início.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { Keypair } = await import("@solana/web3.js");

    const escrow = Keypair.generate();
    const escrowAddress = escrow.publicKey.toBase58();
    const escrowSecret = Buffer.from(escrow.secretKey).toString("base64");

    const { data: row, error } = await (supabaseAdmin as any)
      .from("challenges")
      .insert({
        creator_id: context.userId,
        title: data.title,
        description: data.description,
        cover_url: data.cover_url ?? null,
        token_mint: data.token_mint,
        token_symbol: data.token_symbol ?? null,
        token_name: data.token_name ?? null,
        token_decimals: data.token_decimals,
        total_amount: data.total_amount,
        winners_count: data.winners_count,
        amount_per_winner: data.total_amount / data.winners_count,
        rules_template: data.rules_template,
        rules_json: data.rules_json,
        validation_mode: data.validation_mode,
        starts_at: data.starts_at,
        ends_at: data.ends_at,
        escrow_wallet: escrowAddress,
        status: "awaiting_deposit",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: keyErr } = await (supabaseAdmin as any)
      .from("challenge_escrow_keys")
      .insert({ challenge_id: row.id, secret_key: escrowSecret });
    if (keyErr) throw new Error(keyErr.message);

    return { id: row.id, escrow_wallet: escrowAddress };
  });

// ---------- VERIFY DEPOSIT ----------
export const verifyChallengeDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ challenge_id: z.string().uuid(), signature: z.string().max(150).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c } = await (supabaseAdmin as any)
      .from("challenges")
      .select("id, creator_id, token_mint, token_decimals, total_amount, escrow_wallet, status")
      .eq("id", data.challenge_id)
      .single();
    if (!c) throw new Error("Desafio não encontrado.");
    if (c.creator_id !== context.userId) throw new Error("Só o criador pode verificar o depósito.");
    if (c.status !== "awaiting_deposit") throw new Error("Este desafio não está aguardando depósito.");

    const required = BigInt(Math.round(c.total_amount * 10 ** c.token_decimals));
    const current = await getEscrowBalance(c.escrow_wallet, c.token_mint);
    if (current < required) {
      const missing = Number(required - current) / 10 ** c.token_decimals;
      return { ok: false, current: Number(current) / 10 ** c.token_decimals, required: c.total_amount, missing };
    }

    await (supabaseAdmin as any)
      .from("challenges")
      .update({ status: "active", deposit_verified_at: new Date().toISOString(), deposit_tx: data.signature ?? null })
      .eq("id", c.id);
    return { ok: true };
  });

// ---------- SUBMIT PARTICIPATION ----------
export const submitParticipation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        challenge_id: z.string().uuid(),
        wallet: z.string().trim().min(30).max(50),
        proof_url: z.string().trim().url().max(1000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c } = await (supabaseAdmin as any)
      .from("challenges")
      .select("id, status, starts_at, ends_at")
      .eq("id", data.challenge_id)
      .single();
    if (!c) throw new Error("Desafio não encontrado.");
    if (c.status !== "active") throw new Error("Este desafio não está aberto para participação.");
    const now = Date.now();
    if (now < new Date(c.starts_at).getTime()) throw new Error("Este desafio ainda não começou.");
    if (now > new Date(c.ends_at).getTime()) throw new Error("Este desafio já foi encerrado.");

    const { error } = await (supabaseAdmin as any).from("challenge_participants").insert({
      challenge_id: data.challenge_id,
      user_id: context.userId,
      wallet: data.wallet,
      proof_url: data.proof_url,
    });
    if (error) {
      if (String(error.message).includes("duplicate")) throw new Error("Você já participou deste desafio.");
      throw new Error(error.message);
    }
    return { ok: true };
  });

// ---------- VALIDATE PARTICIPATION (manual) ----------
export const validateParticipation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ participant_id: z.string().uuid(), decision: z.enum(["valid", "invalid"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: p } = await (supabaseAdmin as any)
      .from("challenge_participants")
      .select("id, challenge_id")
      .eq("id", data.participant_id)
      .single();
    if (!p) throw new Error("Participação não encontrada.");
    const { data: c } = await (supabaseAdmin as any)
      .from("challenges")
      .select("creator_id")
      .eq("id", p.challenge_id)
      .single();
    if (!c) throw new Error("Desafio não encontrado.");
    const isCreator = c.creator_id === context.userId;
    let isAdmin = false;
    if (!isCreator) {
      const { data: role } = await context.supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId)
        .in("role", ["admin", "super_admin"])
        .maybeSingle();
      isAdmin = !!role;
    }
    if (!isCreator && !isAdmin) throw new Error("Sem permissão para validar.");

    const { error } = await (supabaseAdmin as any)
      .from("challenge_participants")
      .update({ status: data.decision, validated_by: context.userId, validated_at: new Date().toISOString() })
      .eq("id", data.participant_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- DISTRIBUTE REWARDS ----------
export const distributeRewards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ challenge_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c } = await (supabaseAdmin as any)
      .from("challenges")
      .select("*")
      .eq("id", data.challenge_id)
      .single();
    if (!c) throw new Error("Desafio não encontrado.");
    if (c.creator_id !== context.userId) throw new Error("Só o criador pode distribuir as recompensas.");
    if (!["active", "closed", "failed"].includes(c.status)) {
      throw new Error("Este desafio não está pronto para distribuição.");
    }
    if (new Date(c.ends_at).getTime() > Date.now()) {
      throw new Error("Aguarde o término do desafio para distribuir.");
    }

    // Fetch valid participants
    const { data: validParts } = await (supabaseAdmin as any)
      .from("challenge_participants")
      .select("id, wallet")
      .eq("challenge_id", c.id)
      .eq("status", "valid");
    const parts = (validParts ?? []) as { id: string; wallet: string }[];
    if (parts.length === 0) throw new Error("Nenhum participante válido para distribuir.");

    // Deterministic selection of N winners
    const winners = parts
      .map((p) => ({ p, k: hashStr(c.id + ":" + p.id) }))
      .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0))
      .slice(0, c.winners_count)
      .map((x) => x.p);

    await (supabaseAdmin as any).from("challenges").update({ status: "distributing" }).eq("id", c.id);

    const { data: keyRow } = await (supabaseAdmin as any)
      .from("challenge_escrow_keys")
      .select("secret_key")
      .eq("challenge_id", c.id)
      .single();
    if (!keyRow) throw new Error("Chave da custódia não encontrada.");

    const { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } = await import(
      "@solana/web3.js"
    );
    const spl = await import("@solana/spl-token");

    const conn = new Connection(RPC_URLS[0], "confirmed");
    const escrowKp = Keypair.fromSecretKey(Buffer.from(keyRow.secret_key, "base64"));
    const mintPk = new PublicKey(c.token_mint);
    const fromAta = spl.getAssociatedTokenAddressSync(mintPk, escrowKp.publicKey, true);
    const perWinnerRaw = BigInt(Math.floor(Number(c.amount_per_winner) * 10 ** c.token_decimals));

    let success = 0;
    let failed = 0;

    // batches of 5 transfers per tx
    for (let i = 0; i < winners.length; i += 5) {
      const chunk = winners.slice(i, i + 5);
      const tx = new Transaction();
      const partIds: string[] = [];
      const wallets: string[] = [];

      for (const w of chunk) {
        try {
          const toPk = new PublicKey(w.wallet);
          const toAta = spl.getAssociatedTokenAddressSync(mintPk, toPk, true);
          const info = await conn.getAccountInfo(toAta);
          if (!info) {
            tx.add(spl.createAssociatedTokenAccountInstruction(escrowKp.publicKey, toAta, toPk, mintPk));
          }
          tx.add(
            spl.createTransferCheckedInstruction(
              fromAta,
              mintPk,
              toAta,
              escrowKp.publicKey,
              perWinnerRaw,
              c.token_decimals,
            ),
          );
          partIds.push(w.id);
          wallets.push(w.wallet);
        } catch (e) {
          // skip broken wallet
          await (supabaseAdmin as any).from("challenge_distributions").insert({
            challenge_id: c.id,
            participant_id: w.id,
            wallet: w.wallet,
            amount: c.amount_per_winner,
            status: "failed",
            error: String((e as Error)?.message ?? e),
            attempted_at: new Date().toISOString(),
          });
          failed++;
        }
      }

      if (partIds.length === 0) continue;

      try {
        const sig = await sendAndConfirmTransaction(conn, tx, [escrowKp], { commitment: "confirmed" });
        for (let k = 0; k < partIds.length; k++) {
          await (supabaseAdmin as any).from("challenge_distributions").insert({
            challenge_id: c.id,
            participant_id: partIds[k],
            wallet: wallets[k],
            amount: c.amount_per_winner,
            tx_signature: sig,
            status: "success",
            attempted_at: new Date().toISOString(),
            confirmed_at: new Date().toISOString(),
          });
          success++;
        }
      } catch (e) {
        for (let k = 0; k < partIds.length; k++) {
          await (supabaseAdmin as any).from("challenge_distributions").insert({
            challenge_id: c.id,
            participant_id: partIds[k],
            wallet: wallets[k],
            amount: c.amount_per_winner,
            status: "failed",
            error: String((e as Error)?.message ?? e),
            attempted_at: new Date().toISOString(),
          });
          failed++;
        }
      }
    }

    const finalStatus = failed === 0 ? "completed" : "failed";
    await (supabaseAdmin as any).from("challenges").update({ status: finalStatus }).eq("id", c.id);
    return { ok: true, success, failed, total: winners.length };
  });

// ---------- RETRY FAILED ----------
export const retryFailedDistributions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ challenge_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: c } = await (supabaseAdmin as any)
      .from("challenges")
      .select("id, creator_id, token_mint, token_decimals, amount_per_winner, status")
      .eq("id", data.challenge_id)
      .single();
    if (!c) throw new Error("Desafio não encontrado.");
    if (c.creator_id !== context.userId) throw new Error("Só o criador pode reenviar.");

    const { data: failed } = await (supabaseAdmin as any)
      .from("challenge_distributions")
      .select("id, participant_id, wallet")
      .eq("challenge_id", c.id)
      .eq("status", "failed");
    const rows = (failed ?? []) as { id: string; participant_id: string; wallet: string }[];
    if (rows.length === 0) return { ok: true, success: 0, failed: 0 };

    const { data: keyRow } = await (supabaseAdmin as any)
      .from("challenge_escrow_keys")
      .select("secret_key")
      .eq("challenge_id", c.id)
      .single();
    if (!keyRow) throw new Error("Chave da custódia não encontrada.");

    const { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } = await import(
      "@solana/web3.js"
    );
    const spl = await import("@solana/spl-token");

    const conn = new Connection(RPC_URLS[0], "confirmed");
    const escrowKp = Keypair.fromSecretKey(Buffer.from(keyRow.secret_key, "base64"));
    const mintPk = new PublicKey(c.token_mint);
    const fromAta = spl.getAssociatedTokenAddressSync(mintPk, escrowKp.publicKey, true);
    const perRaw = BigInt(Math.floor(Number(c.amount_per_winner) * 10 ** c.token_decimals));

    let success = 0;
    let stillFailed = 0;
    for (const r of rows) {
      try {
        const toPk = new PublicKey(r.wallet);
        const toAta = spl.getAssociatedTokenAddressSync(mintPk, toPk, true);
        const tx = new Transaction();
        const info = await conn.getAccountInfo(toAta);
        if (!info) tx.add(spl.createAssociatedTokenAccountInstruction(escrowKp.publicKey, toAta, toPk, mintPk));
        tx.add(
          spl.createTransferCheckedInstruction(fromAta, mintPk, toAta, escrowKp.publicKey, perRaw, c.token_decimals),
        );
        const sig = await sendAndConfirmTransaction(conn, tx, [escrowKp], { commitment: "confirmed" });
        await (supabaseAdmin as any)
          .from("challenge_distributions")
          .update({
            status: "success",
            tx_signature: sig,
            error: null,
            attempted_at: new Date().toISOString(),
            confirmed_at: new Date().toISOString(),
          })
          .eq("id", r.id);
        success++;
      } catch (e) {
        await (supabaseAdmin as any)
          .from("challenge_distributions")
          .update({
            error: String((e as Error)?.message ?? e),
            attempted_at: new Date().toISOString(),
          })
          .eq("id", r.id);
        stillFailed++;
      }
    }

    if (stillFailed === 0) {
      await (supabaseAdmin as any).from("challenges").update({ status: "completed" }).eq("id", c.id);
    }
    return { ok: true, success, failed: stillFailed };
  });

function hashStr(s: string): string {
  // simple deterministic 32-bit hash for winner ordering
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
