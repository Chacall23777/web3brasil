import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RPC_URL = "https://api.mainnet-beta.solana.com";
const MINT = "XhHLJpJtEHJucpYpAti2JvNs6eYsjeuFjRj9wvvaLDL";
const BURN_AMOUNT = 3000;
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

async function rpcCall(method: string, params: unknown[]): Promise<any> {
  const delays = [0, 800, 1800, 3500, 6000];
  let lastErr: unknown;
  for (const d of delays) {
    if (d) await new Promise((r) => setTimeout(r, d));
    try {
      const res = await fetch(RPC_URL, {
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
        // some errors deserve retry
        const msg = String(j.error?.message ?? "");
        if (/rate|limit|timeout|not.*confirmed|not.*found/i.test(msg)) {
          lastErr = new Error(msg);
          continue;
        }
        throw new Error(msg);
      }
      return j.result;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(
    "O RPC público da Solana está indisponível ou limitando requisições. Tente novamente em alguns instantes.",
  );
}

function findBurnInstruction(tx: any): {
  type: string;
  info: { mint: string; authority?: string; owner?: string; amount?: string; tokenAmount?: { amount: string; decimals: number } };
} | null {
  const msg = tx?.transaction?.message;
  const ixs: any[] = [
    ...(msg?.instructions ?? []),
    ...((tx?.meta?.innerInstructions ?? []).flatMap((i: any) => i.instructions ?? [])),
  ];
  for (const ix of ixs) {
    if (ix?.programId !== TOKEN_PROGRAM) continue;
    const parsed = ix?.parsed;
    if (!parsed) continue;
    if (parsed.type === "burn" || parsed.type === "burnChecked") return parsed;
  }
  return null;
}

export const verifyBurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        signature: z.string().min(20).max(150),
        wallet_address: z.string().min(30).max(60),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { signature, wallet_address } = data;
    const { supabase, userId } = context;

    // Fetch parsed transaction with retries
    const tx = await rpcCall("getTransaction", [
      signature,
      { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" },
    ]);
    if (!tx) throw new Error("Transação não encontrada. Aguarde alguns instantes e tente novamente.");
    if (tx.meta?.err) throw new Error("A transação falhou on-chain.");

    const burn = findBurnInstruction(tx);
    if (!burn) throw new Error("Nenhuma instrução de queima válida foi encontrada nessa transação.");
    if (burn.info.mint !== MINT) throw new Error("A queima não é do token esperado.");

    const authority = burn.info.authority ?? burn.info.owner;
    if (!authority || authority !== wallet_address) {
      throw new Error("A carteira que assinou a queima não confere com a carteira informada.");
    }

    // Amount check
    let decimals: number | undefined;
    let rawAmount: string | undefined;
    if (burn.type === "burnChecked" && burn.info.tokenAmount) {
      decimals = burn.info.tokenAmount.decimals;
      rawAmount = burn.info.tokenAmount.amount;
    } else if (burn.info.amount) {
      rawAmount = burn.info.amount;
      const mintInfo = await rpcCall("getAccountInfo", [MINT, { encoding: "jsonParsed" }]);
      decimals = mintInfo?.value?.data?.parsed?.info?.decimals;
    }
    if (rawAmount == null || decimals == null) throw new Error("Não foi possível ler a quantidade queimada.");
    const expected = BigInt(BURN_AMOUNT) * BigInt(10) ** BigInt(decimals);
    if (BigInt(rawAmount) !== expected) {
      throw new Error(`A queima precisa ser de exatamente ${BURN_AMOUNT} tokens.`);
    }

    // Check the signature hasn't been used
    const { data: dupe } = await (supabase as any)
      .from("profiles")
      .select("id")
      .eq("verified_tx_signature", signature)
      .maybeSingle();
    if (dupe && dupe.id !== userId) {
      throw new Error("Essa transação de queima já foi usada por outro usuário.");
    }

    // Use admin client to bypass the RLS lock on verification fields
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("profiles")
      .update({
        is_verified: true,
        verified_method: "burn",
        verified_at: new Date().toISOString(),
        verified_tx_signature: signature,
        solana_wallet: wallet_address,
      })
      .eq("id", userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

async function checkRole(
  ctx: { supabase: any; userId: string },
  role: "admin" | "super_admin",
): Promise<boolean> {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: role });
  return !!data;
}

async function requireAdminLike(ctx: { supabase: any; userId: string }): Promise<void> {
  const [isAdmin, isSuper] = await Promise.all([checkRole(ctx, "admin"), checkRole(ctx, "super_admin")]);
  if (!isAdmin && !isSuper) throw new Error("Somente administradores.");
}

async function requireSuperAdmin(ctx: { supabase: any; userId: string }): Promise<void> {
  const isSuper = await checkRole(ctx, "super_admin");
  if (!isSuper) throw new Error("Somente super_admin.");
}

export const adminSearchUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ q: z.string().trim().min(1).max(120) }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdminLike(context);

    const q = data.q;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const like = `%${q}%`;
    const { data: profs } = await (supabaseAdmin as any)
      .from("profiles")
      .select("id, display_name, avatar_url, solana_wallet, telegram_handle, x_handle, instagram_handle, is_verified, verified_method, verified_at")
      .or(
        `display_name.ilike.${like},solana_wallet.ilike.${like},telegram_handle.ilike.${like},x_handle.ilike.${like},instagram_handle.ilike.${like}`,
      )
      .limit(25);

    let emailMatches: Array<{ id: string; email: string | null }> = [];
    try {
      const list = await (supabaseAdmin as any).auth.admin.listUsers({ page: 1, perPage: 200 });
      const users = list?.data?.users ?? [];
      const ql = q.toLowerCase();
      emailMatches = users
        .filter((u: any) => (u.email ?? "").toLowerCase().includes(ql))
        .slice(0, 25)
        .map((u: any) => ({ id: u.id, email: u.email ?? null }));
    } catch {
      // ignore
    }

    const emailIds = emailMatches.map((e) => e.id);
    let extra: any[] = [];
    if (emailIds.length) {
      const { data: extraProfs } = await (supabaseAdmin as any)
        .from("profiles")
        .select("id, display_name, avatar_url, solana_wallet, telegram_handle, x_handle, instagram_handle, is_verified, verified_method, verified_at")
        .in("id", emailIds);
      extra = extraProfs ?? [];
    }

    const byId = new Map<string, any>();
    for (const p of [...(profs ?? []), ...extra]) byId.set(p.id, p);
    const ids = Array.from(byId.keys());

    // Fetch roles for all matched users
    let rolesById = new Map<string, string[]>();
    if (ids.length) {
      const { data: rolesRows } = await (supabaseAdmin as any)
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", ids);
      for (const r of rolesRows ?? []) {
        const arr = rolesById.get(r.user_id) ?? [];
        arr.push(r.role);
        rolesById.set(r.user_id, arr);
      }
    }

    const emailMap = new Map(emailMatches.map((e) => [e.id, e.email]));
    const results = Array.from(byId.values()).map((p) => ({
      ...p,
      email: emailMap.get(p.id) ?? null,
      roles: rolesById.get(p.id) ?? [],
    }));
    return { results };
  });

export const adminSetVerified = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ target_user_id: z.string().uuid(), verified: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdminLike(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch = data.verified
      ? {
          is_verified: true,
          verified_method: "admin",
          verified_at: new Date().toISOString(),
          verified_by_admin_id: context.userId,
        }
      : {
          is_verified: false,
          verified_method: null,
          verified_at: null,
          verified_by_admin_id: null,
          verified_tx_signature: null,
        };
    const { error } = await (supabaseAdmin as any)
      .from("profiles")
      .update(patch)
      .eq("id", data.target_user_id);
    if (error) throw new Error(error.message);

    await (supabaseAdmin as any).from("admin_actions").insert({
      admin_id: context.userId,
      target_user_id: data.target_user_id,
      action: data.verified ? "grant_verified" : "revoke_verified",
      details: null,
    });

    return { ok: true };
  });

export const adminPromoteToAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ target_user_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    if (data.target_user_id === context.userId) {
      throw new Error("Não é possível alterar seu próprio nível.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Don't touch super_admins
    const { data: existing } = await (supabaseAdmin as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", data.target_user_id);
    const roles = (existing ?? []).map((r: any) => r.role);
    if (roles.includes("super_admin")) throw new Error("O alvo é super_admin.");
    if (roles.includes("admin")) throw new Error("Usuário já é admin.");

    const { error } = await (supabaseAdmin as any)
      .from("user_roles")
      .insert({ user_id: data.target_user_id, role: "admin" });
    if (error) throw new Error(error.message);

    await (supabaseAdmin as any).from("admin_actions").insert({
      admin_id: context.userId,
      target_user_id: data.target_user_id,
      action: "promote_admin",
      details: null,
    });
    return { ok: true };
  });

export const adminDemoteFromAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ target_user_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireSuperAdmin(context);
    if (data.target_user_id === context.userId) {
      throw new Error("Não é possível rebaixar a si mesmo.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await (supabaseAdmin as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", data.target_user_id);
    const roles = (existing ?? []).map((r: any) => r.role);
    if (roles.includes("super_admin")) throw new Error("Não é possível rebaixar um super_admin.");
    if (!roles.includes("admin")) throw new Error("Usuário não é admin.");

    const { error } = await (supabaseAdmin as any)
      .from("user_roles")
      .delete()
      .eq("user_id", data.target_user_id)
      .eq("role", "admin");
    if (error) throw new Error(error.message);

    await (supabaseAdmin as any).from("admin_actions").insert({
      admin_id: context.userId,
      target_user_id: data.target_user_id,
      action: "demote_admin",
      details: null,
    });
    return { ok: true };
  });

