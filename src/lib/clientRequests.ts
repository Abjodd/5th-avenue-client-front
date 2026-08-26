/* Client helper for the three public forms — "Start a project", "Apply as a
   creator" and the Careers page's "Tell us about you". Each POSTs straight to
   the Fifth Avenue internal backend (5th-internal-back), which saves the
   submission as a row the founder triages in the Requests page AND emails them
   — see routes/{client,creator,career}Requests.js and mailer.js in that repo.

   Set VITE_API_URL to point at a non-local backend (same convention the
   internal portal frontend uses); defaults to localhost:4000 for local dev. */

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

/** Address shown in the "or email us directly" fallback when a send fails. */
export const CONTACT_EMAIL = "contact@fifth-avenue.in";

export interface ClientRequestFields {
  name: string;
  role?: string;
  contact: string;
  organisation?: string;
  headquarters?: string;
  goal?: string;
}

export interface SubmitResult {
  ok: boolean;
  error?: string;
}

export interface CareerRequestFields {
  name: string;
  email: string;
  /** Opening id from data/careers.ts, or "general" for an open application. */
  roleId: string;
  /** Sent alongside the id so the inbox still reads correctly once an opening
   *  is retired from that list — see models/CareerRequest.js in the backend. */
  roleTitle: string;
  link?: string;
  note?: string;
}

export interface CreatorRequestFields {
  name: string;
  handle: string;
  platform?: string;
  email?: string;
  phone?: string;
  state?: string;
  followers?: string;
  niche?: string[];
  languages?: string[];
}

async function post(path: string, body: unknown): Promise<SubmitResult> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.error || `Submission failed (${res.status}).` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Network error — please try again." };
  }
}

/** "Start a project" — lands in the founder's Client Requests tab. */
export const submitClientRequest = (fields: ClientRequestFields) =>
  post("/api/client-requests", fields);

/** "Apply as a creator" — lands in the founder's Creators › Creator Requests tab. */
export const submitCreatorRequest = (fields: CreatorRequestFields) =>
  post("/api/creator-requests", fields);

/** Careers page "Tell us about you" — lands in Requests › Career Requests. */
export const submitCareerRequest = (fields: CareerRequestFields) =>
  post("/api/career-requests", fields);
