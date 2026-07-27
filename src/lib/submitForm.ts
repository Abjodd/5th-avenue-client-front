/* Client helper for the public lead/application forms. POSTs the submission to
   the serverless mailer (api/submit-form), which emails it to the 5th Avenue
   inbox (contact@fifth-avenue.in). Returns a friendly result the form renders. */

export type FormType = "apply" | "start" | "careers";

/** Address shown in the "or email us directly" fallback when a send fails. */
export const CONTACT_EMAIL = "contact@fifth-avenue.in";

export interface SubmitResult {
  ok: boolean;
  error?: string;
}

export async function submitForm(
  formType: FormType,
  fields: Record<string, string | undefined>,
): Promise<SubmitResult> {
  // Drop empty values so the email stays tidy.
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v != null && String(v).trim() !== "") clean[k] = String(v).trim();
  }

  try {
    const res = await fetch("/api/submit-form", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ formType, fields: clean }),
    });
    const data = (await res.json().catch(() => ({}))) as SubmitResult;
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || `Submission failed (${res.status}).` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error — please try again." };
  }
}
