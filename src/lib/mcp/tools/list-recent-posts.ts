import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

export default defineTool({
  name: "list_recent_posts",
  title: "List recent posts",
  description: "List the most recent community posts from WEB3BRASIL.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Max posts to return (default 10)."),
    type: z.enum(["post", "token"]).optional().describe("Filter by post type."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, type }) => {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let q = supabase
      .from("posts")
      .select("id,title,content,content_original,type,token_name,token_symbol,token_chain,token_contract,image_url,created_at,user_id")
      .order("created_at", { ascending: false })
      .limit(limit ?? 10);
    if (type) q = q.eq("type", type);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { posts: data ?? [] },
    };
  },
});
