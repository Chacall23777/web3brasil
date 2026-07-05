import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });
}

const createPostSchema = z.object({
  type: z.enum(["text", "token"]).default("text"),
  title: z.string().trim().max(200).optional().nullable(),
  content: z.string().trim().min(1).max(10000),
  image_url: z.string().url().max(2048).optional().nullable(),
  token_name: z.string().trim().max(80).optional().nullable(),
  token_symbol: z.string().trim().max(20).optional().nullable(),
  token_contract: z.string().trim().max(120).optional().nullable(),
  token_chain: z.string().trim().max(30).optional().nullable(),
  token_link: z
    .string()
    .trim()
    .max(500)
    .refine(
      (v) => {
        try {
          const u = new URL(v);
          return u.protocol === "http:" || u.protocol === "https:";
        } catch {
          return false;
        }
      },
      { message: "token_link must be http(s) URL" },
    )
    .optional()
    .nullable(),
});

export const Route = createFileRoute("/api/v1/posts")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      GET: async ({ request }) => {
        const url = new URL(request.url);
        const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));
        const cursor = url.searchParams.get("cursor");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let q = supabaseAdmin
          .from("posts")
          .select(
            "id, type, title, content, image_url, token_name, token_symbol, token_contract, token_chain, token_link, user_id, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(limit);
        if (cursor) q = q.lt("created_at", cursor);
        const { data, error } = await q;
        if (error) return j({ error: { code: "server_error", message: error.message } }, 500);
        return j({
          posts: data ?? [],
          next_cursor: data && data.length === limit ? data[data.length - 1].created_at : null,
        });
      },

      POST: async ({ request }) => {
        const { authenticateAgent, checkAndRecordEvent, errorResponse } = await import(
          "@/lib/ai-agents.server"
        );
        const auth = await authenticateAgent(request);
        if (!auth.ok) {
          const r = errorResponse(auth.status, auth.status === 401 ? "unauthorized" : "forbidden", auth.error);
          Object.entries(CORS).forEach(([k, v]) => r.headers.set(k, v));
          return r;
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return j({ error: { code: "invalid_json", message: "Request body must be JSON" } }, 400);
        }
        const parsed = createPostSchema.safeParse(body);
        if (!parsed.success) {
          return j(
            { error: { code: "validation_error", message: "Invalid payload", issues: parsed.error.issues } },
            422,
          );
        }

        const rl = await checkAndRecordEvent(auth.agent, "post");
        if (rl.limited) {
          const r = j(
            { error: { code: "rate_limited", message: "Hourly post limit reached", retry_after: rl.retryAfter } },
            429,
          );
          r.headers.set("Retry-After", String(rl.retryAfter));
          return r;
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const p = parsed.data;
        const { data: post, error } = await supabaseAdmin
          .from("posts")
          .insert({
            user_id: auth.agent.user_id,
            type: p.type,
            title: p.title ?? null,
            content: p.content,
            content_original: p.content,
            image_url: p.image_url ?? null,
            token_name: p.token_name ?? null,
            token_symbol: p.token_symbol ?? null,
            token_contract: p.token_contract ?? null,
            token_chain: p.token_chain ?? null,
            token_link: p.token_link ?? null,
          } as any)
          .select("id, created_at")
          .single();
        if (error || !post) {
          return j({ error: { code: "server_error", message: error?.message ?? "Insert failed" } }, 500);
        }
        return j({ id: post.id, created_at: post.created_at }, 201);
      },
    },
  },
});
