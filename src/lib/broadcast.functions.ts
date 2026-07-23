import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function checkRole(ctx: { supabase: any; userId: string }, role: "admin" | "super_admin"): Promise<boolean> {
  const { data } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: role });
  return !!data;
}

async function requireAdminLike(ctx: { supabase: any; userId: string }): Promise<void> {
  const [isAdmin, isSuper] = await Promise.all([checkRole(ctx, "admin"), checkRole(ctx, "super_admin")]);
  if (!isAdmin && !isSuper) throw new Error("Somente administradores.");
}

async function collectAllEmails(supabaseAdmin: any): Promise<string[]> {
  const emails = new Set<string>();
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const users = data?.users ?? [];
    for (const u of users) {
      if (u.email && !u.banned_until) emails.add(u.email.toLowerCase());
    }
    if (users.length < perPage) break;
    page += 1;
    if (page > 50) break;
  }
  return Array.from(emails);
}

export const adminSendBroadcastEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        subject: z.string().trim().min(3).max(150),
        message: z.string().trim().min(3).max(5000),
        post_id: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdminLike(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const postUrl = data.post_id ? `https://web3brasil.life/post/${data.post_id}` : null;
    const emails = await collectAllEmails(supabaseAdmin);
    if (emails.length === 0) throw new Error("Nenhum e-mail cadastrado para enviar.");

    const { data: fnResult, error: fnError } = await (supabaseAdmin as any).functions.invoke(
      "send-broadcast-email",
      { body: { subject: data.subject, message: data.message, postUrl, emails } },
    );

    if (fnError) throw new Error(fnError.message ?? "Falha ao chamar a função de envio de e-mail.");
    if (fnResult?.error) throw new Error(fnResult.error);

    const sent = fnResult?.count ?? emails.length;

    await (supabaseAdmin as any).from("email_broadcasts").insert({
      admin_id: context.userId,
      subject: data.subject,
      message: data.message,
      post_id: data.post_id ?? null,
      recipients_count: sent,
    });

    return { ok: true, count: sent };
  });

export const adminListBroadcastHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdminLike(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("email_broadcasts")
      .select("id, subject, recipients_count, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return { history: data ?? [] };
  });
