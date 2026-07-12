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

function renderEmailHtml(subject: string, message: string, postUrl: string | null) {
  const safeMessage = message
    .split("\n")
    .map((line) => `<p style="margin:0 0 12px;line-height:1.5;">${line}</p>`)
    .join("");
  const cta = postUrl
    ? `<p style="margin:24px 0 0;"><a href="${postUrl}" style="background:#16a34a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">Ver postagem</a></p>`
    : "";
  return `
  <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;">
    <h1 style="font-size:18px;margin:0 0 16px;">${subject}</h1>
    ${safeMessage}
    ${cta}
    <hr style="margin:32px 0 12px;border:none;border-top:1px solid #e5e5e5;" />
    <p style="font-size:12px;color:#888;margin:0;">Você recebeu este e-mail porque tem uma conta na WEB3BRASIL (web3brasil.life).</p>
  </div>`;
}

async function sendViaResend(apiKey: string, from: string, subject: string, html: string, emails: string[]) {
  const BATCH = 100;
  let sent = 0;
  for (let i = 0; i < emails.length; i += BATCH) {
    const chunk = emails.slice(i, i + BATCH);
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        chunk.map((to) => ({ from, to: [to], subject, html })),
      ),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Falha ao enviar e-mails (Resend ${res.status}): ${body.slice(0, 300)}`);
    }
    sent += chunk.length;
  }
  return sent;
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

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "WEB3BRASIL <onboarding@resend.dev>";
    if (!RESEND_API_KEY) {
      throw new Error(
        "RESEND_API_KEY não configurada. Adicione essa secret no projeto (Lovable Cloud / Supabase) para habilitar o envio de e-mails.",
      );
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const postUrl = data.post_id ? `https://web3brasil.life/post/${data.post_id}` : null;
    const emails = await collectAllEmails(supabaseAdmin);
    if (emails.length === 0) throw new Error("Nenhum e-mail cadastrado para enviar.");

    const html = renderEmailHtml(data.subject, data.message, postUrl);
    const sent = await sendViaResend(RESEND_API_KEY, RESEND_FROM_EMAIL, data.subject, html, emails);

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
