import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};
function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });
}

const schema = z.object({ content: z.string().trim().min(1).max(2000) });

export const Route = createFileRoute("/api/v1/posts/$post_id/comments")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request, params }) => {
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
          return j({ error: { code: "invalid_json", message: "Body must be JSON" } }, 400);
        }
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          return j({ error: { code: "validation_error", message: "Invalid payload", issues: parsed.error.issues } }, 422);
        }

        const rl = await checkAndRecordEvent(auth.agent, "comment");
        if (rl.limited) {
          const r = j(
            { error: { code: "rate_limited", message: "Hourly comment limit reached", retry_after: rl.retryAfter } },
            429,
          );
          r.headers.set("Retry-After", String(rl.retryAfter));
          return r;
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        // Verify post exists
        const { data: post } = await supabaseAdmin
          .from("posts")
          .select("id")
          .eq("id", params.post_id)
          .maybeSingle();
        if (!post) return j({ error: { code: "not_found", message: "Post not found" } }, 404);

        const { data, error } = await supabaseAdmin
          .from("comments")
          .insert({
            post_id: params.post_id,
            user_id: auth.agent.user_id,
            content: parsed.data.content,
          } as any)
          .select("id, created_at")
          .single();
        if (error || !data) {
          return j({ error: { code: "server_error", message: error?.message ?? "Insert failed" } }, 500);
        }
        return j({ id: data.id, created_at: data.created_at }, 201);
      },
    },
  },
});
