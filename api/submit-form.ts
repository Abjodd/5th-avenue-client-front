// Vercel Edge Function — emails public website form submissions to the
// 5th Avenue inbox. Zero npm dependencies: it POSTs to the Resend REST API
// with fetch, so nothing needs installing beyond the platform runtime.
//
// Configure in Vercel → Project → Settings → Environment Variables:
//   RESEND_API_KEY   (required)  a Resend API key for the verified
//                                fifth-avenue.in sending domain
//   FORM_TO          (optional)  recipient — default contact@fifth-avenue.in
//   FORM_FROM        (optional)  verified sender —
//                                default "5th Avenue <forms@fifth-avenue.in>"
//
// Local `vite dev` does not run this function; use `vercel dev` (or a real
// deploy) to exercise it end to end.

export const config = { runtime: "edge" };

const FORM_META: Record<string, { label: string; subject: string }> = {
  apply: { label: "Creator application", subject: "New creator application — 5th Avenue" },
  start: { label: "Project enquiry", subject: "New project enquiry — 5th Avenue" },
  careers: { label: "Careers application", subject: "New careers application — 5th Avenue" },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return json({ ok: false, error: "Email is not configured on the server." }, 500);

  const to = process.env.FORM_TO || "contact@fifth-avenue.in";
  const from = process.env.FORM_FROM || "5th Avenue <forms@fifth-avenue.in>";

  let body: { formType?: string; fields?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid request body." }, 400);
  }

  const formType = typeof body?.formType === "string" ? body.formType : "contact";
  const fields = body?.fields && typeof body.fields === "object" ? body.fields : {};
  const meta = FORM_META[formType] || { label: "Website enquiry", subject: "New website enquiry — 5th Avenue" };

  const entries = Object.entries(fields).filter(([, v]) => v != null && String(v).trim() !== "");
  if (entries.length === 0) return json({ ok: false, error: "Nothing to submit." }, 400);

  // Reply-To = the first email-looking value, so a reply reaches the sender.
  const replyTo = entries.map(([, v]) => String(v).trim()).find((v) => EMAIL_RE.test(v));

  const rows = entries
    .map(
      ([k, v]) =>
        `<tr><td style="padding:5px 16px 5px 0;color:#5f6b85;white-space:nowrap;vertical-align:top;">${esc(k)}</td><td style="padding:5px 0;color:#0d1a3d;"><strong>${esc(String(v))}</strong></td></tr>`,
    )
    .join("");
  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.5;">
    <p style="margin:0 0 14px;color:#0d1a3d;">New <strong>${esc(meta.label)}</strong> from the 5th Avenue website.</p>
    <table style="border-collapse:collapse;">${rows}</table>
  </div>`;
  const text =
    `New ${meta.label} from the 5th Avenue website.\n\n` +
    entries.map(([k, v]) => `${k}: ${v}`).join("\n");

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        subject: meta.subject,
        html,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      return json({ ok: false, error: "The email provider rejected the request.", detail }, 502);
    }
    return json({ ok: true });
  } catch {
    return json({ ok: false, error: "Failed to reach the email provider." }, 502);
  }
}
