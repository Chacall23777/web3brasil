import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateApiKey, hashApiKey, apiKeyPrefix } from "@/lib/api-key";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const [{ data: isAdmin }, { data: isSuper }] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "super_admin" }),
  ]);
  if (!isAdmin && !isSuper) {
    throw new Error("Forbidden");
  }
}

const createSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(500).optional().nullable(),
  operator_contact: z.string().trim().min(3).max(200),
  rate_limit_per_hour: z.number().int().min(1).max(1000).default(20),
});

export const createAiAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Create shadow auth user
    const email = `agent-${crypto.randomUUID()}@ai.web3brasil.local`;
    const password = crypto.randomUUID() + crypto.randomUUID();
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: data.name },
    });
    if (createErr || !created?.user) {
      throw new Error(createErr?.message ?? "Failed to create agent user");
    }
    const userId = created.user.id;

    // 2) Update profile display name + account_type
    const { error: profErr } = await supabaseAdmin
      .from("profiles")
      .update({
        display_name: data.name,
        account_type: "ai_agent",
        is_verified: false,
      } as any)
      .eq("id", userId);
    if (profErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
      throw new Error(profErr.message);
    }

    // 3) Generate API key + insert ai_agents row
    const apiKey = generateApiKey();
    const hash = await hashApiKey(apiKey);
    const prefix = apiKeyPrefix(apiKey);

    const { data: agent, error: agentErr } = await supabaseAdmin
      .from("ai_agents")
      .insert({
        user_id: userId,
        name: data.name,
        description: data.description ?? null,
        operator_contact: data.operator_contact,
        api_key_hash: hash,
        api_key_prefix: prefix,
        rate_limit_per_hour: data.rate_limit_per_hour,
        created_by_admin_id: context.userId,
      } as any)
      .select("id")
      .single();
    if (agentErr || !agent) {
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
      throw new Error(agentErr?.message ?? "Failed to create agent");
    }

    // Return raw API key ONE TIME ONLY.
    return { id: agent.id, api_key: apiKey, user_id: userId };
  });

export const listAiAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("ai_agents")
      .select("id, name, description, operator_contact, api_key_prefix, rate_limit_per_hour, is_suspended, created_at, user_id")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { agents: data ?? [] };
  });

export const setAiAgentSuspended = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), suspended: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("ai_agents")
      .update({ is_suspended: data.suspended } as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const rotateAiAgentKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const apiKey = generateApiKey();
    const hash = await hashApiKey(apiKey);
    const prefix = apiKeyPrefix(apiKey);
    const { error } = await supabaseAdmin
      .from("ai_agents")
      .update({ api_key_hash: hash, api_key_prefix: prefix } as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { api_key: apiKey };
  });

export const updateAiAgentLimit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), rate_limit_per_hour: z.number().int().min(1).max(1000) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("ai_agents")
      .update({ rate_limit_per_hour: data.rate_limit_per_hour } as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAiAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: agent } = await supabaseAdmin
      .from("ai_agents")
      .select("user_id")
      .eq("id", data.id)
      .maybeSingle();
    await supabaseAdmin.from("ai_agents").delete().eq("id", data.id);
    if (agent?.user_id) {
      await supabaseAdmin.auth.admin.deleteUser(agent.user_id).catch(() => {});
    }
    return { ok: true };
  });
