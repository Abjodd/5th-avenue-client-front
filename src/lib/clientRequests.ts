/* Client helper for the "Start a project" form. POSTs straight to the 5th
   Avenue internal backend (5th-internal-back), which saves the signup as a
   ClientRequest and emails the founder — see routes/clientRequests.js and
   mailer.js in that repo. Set VITE_API_URL to point at a non-local backend
   (same convention the internal portal frontend uses); defaults to
   localhost:4000 for local dev. */

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

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
