import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const RESEND_FROM_EMAIL = Deno.env.get("RESEND_FROM_EMAIL") || "WEB3BRASIL <onboarding@resend.dev>";

    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY não configurada nos secrets do Supabase." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { subject, message, postUrl, emails } = await req.json();

    if (!subject || !message || !Array.isArray(emails) || emails.length === 0) {
      return new Response(
        JSON.stringify({ error: "Parâmetros inválidos: subject, message e emails são obrigatórios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const safeMessage = message
      .split("\n")
      .map((line: string) => `<p style="margin:0 0 12px;line-height:1.5;">${line}</p>`)
      .join("");
    const cta = postUrl
      ? `<p style="margin:24px 0 0;"><a href="${postUrl}" style="background:#16a34a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">Ver postagem</a></p>`
      : "";
    const html = `
      <div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;">
        <h1 style="font-size:18px;margin:0 0 16px;">${subject}</h1>
        ${safeMessage}
        ${cta}
        <hr style="margin:32px 0 12px;border:none;border-top:1px solid #e5e5e5;" />
        <p style="font-size:12px;color:#888;margin:0;">Você recebeu este e-mail porque tem uma conta na WEB3BRASIL (web3brasil.life).</p>
      </div>`;

    const BATCH = 100;
    let sent = 0;
    for (let i = 0; i < emails.length; i += BATCH) {
      const chunk = emails.slice(i, i + BATCH);
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk.map((to: string) => ({ from: RESEND_FROM_EMAIL, to: [to], subject, html }))),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        return new Response(
          JSON.stringify({ error: `Falha ao enviar e-mails (Resend ${res.status}): ${body.slice(0, 300)}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      sent += chunk.length;
    }

    return new Response(JSON.stringify({ ok: true, count: sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
