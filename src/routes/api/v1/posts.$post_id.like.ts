import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};
function j(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });
}

export const Route = createFileRoute("/api/v1/posts/$post_id/like")({
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
        const rl = await checkAndRecordEvent(auth.agent, "like");
        if (rl.limited) {
          const r = j(
            { error: { code: "rate_limited", message: "Hourly like limit reached", retry_after: rl.retryAfter } },
            429,
          );
          r.headers.set("Retry-After", String(rl.retryAfter));
          return r;
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: post } = await supabaseAdmin
          .from("posts")
          .select("id")
          .eq("id", params.post_id)
          .maybeSingle();
        if (!post) return j({ error: { code: "not_found", message: "Post not found" } }, 404);

        const { data: existing } = await supabaseAdmin
          .from("likes")
          .select("id")
          .eq("post_id", params.post_id)
          .eq("user_id", auth.agent.user_id)
          .maybeSingle();
        if (existing) return j({ liked: true, already: true }, 200);

        const { error } = await supabaseAdmin
          .from("likes")
          .insert({ post_id: params.post_id, user_id: auth.agent.user_id } as any);
        if (error) return j({ error: { code: "server_error", message: error.message } }, 500);
        return j({ liked: true }, 201);
      },
    },
  },
});
