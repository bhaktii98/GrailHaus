import { authToken } from "../lib/authToken";
import { getDeviceId } from "../lib/deviceId";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

/** Generous but bounded — long enough that a slow mobile network isn't mistaken for a dead one,
 * short enough that a truly dropped connection (airplane mode mid-request, dead wifi handoff)
 * surfaces as "offline" within a human-tolerable wait instead of hanging the UI forever. Every
 * caller up the stack (viewmodels, the pending-purchase/active-reveal reconcilers) treats
 * `NetworkError` as "we don't know what happened, safe to retry with the same idempotency key" —
 * this timeout is what guarantees that state is actually reached instead of a spinner that never
 * resolves either way. */
const REQUEST_TIMEOUT_MS = 15_000;

/** A real HTTP response came back and it was an error — the server has an opinion (400/401/404/
 * 409/500...) and that opinion is final. Never safe to blindly retry as-is. */
export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/**
 * No response ever came back — offline, airplane mode, timeout, DNS hiccup, the request died in
 * transit. Distinct from `ApiError` on purpose: callers (see purchaseService/pendingPurchase.ts,
 * activeReveal.ts, and the marketplace viewmodels) treat this as "we genuinely don't know whether
 * the server saw this," which for anything wrapped in an idempotency key means "safe, and
 * correct, to retry" — where an `ApiError` (a definite 4xx/5xx) usually means retrying verbatim
 * would just fail the same way again.
 */
export class NetworkError extends Error {
  constructor(message = "Couldn't reach GrailHaus — check your connection.") {
    super(message);
  }
}

async function authHeaders(): Promise<HeadersInit> {
  const token = await authToken.get();
  const deviceId = await getDeviceId();
  const headers: Record<string, string> = { "X-Device-Id": deviceId };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** Wraps `fetch` so a dead connection fails fast and predictably (via AbortController) instead
 * of hanging indefinitely, and so every non-HTTP failure — timeout, airplane mode, DNS, TLS,
 * a connection reset mid-flight — comes out the same documented shape (`NetworkError`) regardless
 * of which cryptic error the underlying platform throws for it. */
async function request(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${API_URL}${path}`, { ...init, signal: controller.signal });
  } catch {
    // fetch() rejects (not a resolved error response) for exactly the "did this even reach the
    // server" cases — network down, DNS failure, TLS error, or our own timeout aborting it.
    throw new NetworkError();
  } finally {
    clearTimeout(timer);
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await request(path, { headers: await authHeaders() });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? `GET ${path} failed`, res.status);
  }
  return res.json();
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const headers = { ...(await authHeaders()), "Content-Type": "application/json" };
  const res = await request(path, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const responseBody = await res.json().catch(() => ({}));
    throw new ApiError(responseBody.error ?? `POST ${path} failed`, res.status);
  }
  return res.json();
}
