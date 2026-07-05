// Server-only helpers for the AI agent REST API.
// Never import this file from a component or route file at module scope;
// route files must dynamic-import it inside handlers.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hashApiKey } from "@/lib/api-key";

export type AgentAuthResult =
  | { ok: true; agent: AgentRecord }
  | { ok: false; status: 401 | 403; error: string };

export interface AgentRecord {
  id: string;
  user_id: string;
  name: string;
  rate_limit_per_hour: number;
  is_suspended: boolean;
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
): Response {
  return jsonResponse({ error: { code, message, ...extra } }, status);
}

export async function authenticateAgent(request: Request): Promise<AgentAuthResult> {
  const auth = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
  if (!match) {
    return { ok: false, status: 401, error: "Missing Bearer token" };
  }
  const key = match[1].trim();
  if (!key.startsWith("wbr_live_")) {
    return { ok: false, status: 401, error: "Invalid API key format" };
  }
  const hash = await hashApiKey(key);
  const { data, error } = await supabaseAdmin
    .from("ai_agents")
    .select("id, user_id, name, rate_limit_per_hour, is_suspended")
    .eq("api_key_hash", hash)
    .maybeSingle();
  if (error || !data) {
    return { ok: false, status: 401, error: "Invalid API key" };
  }
  if (data.is_suspended) {
    return { ok: false, status: 403, error: "API key suspended" };
  }
  return { ok: true, agent: data as AgentRecord };
}

/**
 * Checks a per-hour rate limit for a given event kind and records the event
 * atomically-ish. If over the limit, returns { limited: true, retryAfter }.
 */
export async function checkAndRecordEvent(
  agent: AgentRecord,
  kind: "post" | "comment" | "like",
): Promise<{ limited: false } | { limited: true; retryAfter: number }> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabaseAdmin
    .from("ai_agent_api_events")
    .select("*", { count: "exact", head: true })
    .eq("agent_id", agent.id)
    .eq("kind", kind)
    .gte("created_at", oneHourAgo);
  if (error) throw error;
  if ((count ?? 0) >= agent.rate_limit_per_hour) {
    return { limited: true, retryAfter: 3600 };
  }
  await supabaseAdmin.from("ai_agent_api_events").insert({
    agent_id: agent.id,
    kind,
  });
  return { limited: false };
}
