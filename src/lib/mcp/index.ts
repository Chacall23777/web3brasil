import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listRecentPosts from "./tools/list-recent-posts";
import getPost from "./tools/get-post";
import listTeamMembers from "./tools/list-team-members";
import listTickerTokens from "./tools/list-ticker-tokens";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://ofzzrmqiedmyfjaupaka.supabase.co";

export default defineMcp({
  name: "web3brasil-mcp",
  title: "WEB3BRASIL",
  version: "0.1.0",
  instructions:
    "Read-only tools for the WEB3BRASIL community platform: browse recent posts, fetch a post by ID, list team members, and list tokens shown in the site ticker.",
  tools: [listRecentPosts, getPost, listTeamMembers, listTickerTokens],
  auth: auth.oauth.issuer({
    issuer: `${SUPABASE_URL}/auth/v1`,
    jwksUri: `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
    acceptedAudiences: ["authenticated"],
    resourceName: "WEB3BRASIL MCP",
  }),
});

