import "server-only";

import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "@/lib/env";
import { fetchWithTimeout, unwrapResponse } from "@/lib/api/envelope";
import { ApiError } from "@/lib/api/errors";

/** Server-to-backend call used by the auth route handlers. Never logs bodies. */
export async function backendFetch<T>(
  path: string,
  init: { method?: string; body?: unknown; accessToken?: string; headers?: Record<string, string> } = {},
): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json", ...init.headers };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (init.accessToken) headers.authorization = `Bearer ${init.accessToken}`;

  const res = await fetchWithTimeout(
    `${API_BASE_URL}${path}`,
    {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    },
    REQUEST_TIMEOUT_MS,
  );
  return unwrapResponse<T>(res);
}

/** Route handlers answer in the backend's own envelope so the browser unwraps once. */
export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ success: true, data }, withNoStore(init));
}

export function fail(status: number, message: string | string[], error: string): Response {
  return Response.json(
    { success: false, error: { statusCode: status, message, error } },
    withNoStore({ status }),
  );
}

export function failFrom(e: unknown): Response {
  if (e instanceof ApiError) {
    if (e.kind === "http") return fail(e.status, e.messages, e.code);
    // Transport problems surface as 503/504 so the browser keeps the session and retries.
    return fail(e.kind === "timeout" ? 504 : 503, [], e.kind === "timeout" ? "Timeout" : "Unavailable");
  }
  return fail(500, [], "Internal Server Error");
}

function withNoStore(init?: ResponseInit): ResponseInit {
  const headers = new Headers(init?.headers);
  headers.set("cache-control", "no-store");
  return { ...init, headers };
}

/**
 * Rejects cross-site requests to the auth endpoints. The session cookie is
 * SameSite=Strict already; this is a second, explicit layer.
 */
export function isCrossSite(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return true;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return true;
  return false;
}
