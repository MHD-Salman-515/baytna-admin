// Browser API client. Feature code calls `api.get/getPage/post` and receives
// the unwrapped `data` typed as T, or an ApiError. It never sees the envelope,
// the bearer header, or the refresh dance.

import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "@/lib/env";
import { refreshSession } from "@/lib/auth/refresh";
import { secondsUntilExpiry, sessionStore } from "@/lib/auth/session";
import { trackRequest } from "./activity";
import { fetchWithTimeout, unwrapPage, unwrapResponse, type Page } from "./envelope";
import { ApiError } from "./errors";

type Query = Record<string, string | number | boolean | undefined | null>;

type RequestOptions = {
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
  /** Public endpoints (e.g. /countries) skip the bearer token. */
  auth?: boolean;
  /** Call this app's own route handlers (/api/...) instead of the backend. */
  local?: boolean;
};

type Reader<R> = (res: Response) => Promise<R>;

/** Refresh slightly before the 15-minute access token actually expires. */
const EXPIRY_SKEW_SECONDS = 30;

function buildUrl(path: string, opts: RequestOptions): string {
  const base = opts.local ? window.location.origin : API_BASE_URL;
  const url = new URL(`${base}${path}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

/**
 * Returns a usable access token. If a refresh is in flight (from any caller)
 * this waits for it, so requests queue behind a refresh and go out after it.
 */
async function getAccessToken(): Promise<string> {
  const token = sessionStore.accessToken();
  if (token && secondsUntilExpiry(token) > EXPIRY_SKEW_SECONDS) return token;
  return (await refreshSession()).accessToken;
}

async function send(method: string, path: string, opts: RequestOptions, token?: string) {
  const headers: Record<string, string> = { accept: "application/json" };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (token) headers.authorization = `Bearer ${token}`;
  return fetchWithTimeout(
    buildUrl(path, opts),
    {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
      cache: "no-store",
      credentials: opts.local ? "same-origin" : "omit",
      referrerPolicy: "no-referrer",
    },
    REQUEST_TIMEOUT_MS,
  );
}

async function request<R>(method: string, path: string, opts: RequestOptions, read: Reader<R>): Promise<R> {
  const done = trackRequest();
  try {
    if (opts.auth === false) return await read(await send(method, path, opts));

    const token = await getAccessToken();
    try {
      return await read(await send(method, path, opts, token));
    } catch (e) {
      if (!(e instanceof ApiError && e.isUnauthorized)) throw e;
      // The token was rejected. Refresh once (shared with every other caller
      // that hit the same 401) unless someone already did, then replay.
      const current = sessionStore.accessToken();
      const fresh = current && current !== token ? current : (await refreshSession()).accessToken;
      try {
        return await read(await send(method, path, opts, fresh));
      } catch (retryError) {
        if (retryError instanceof ApiError && retryError.isUnauthorized) {
          sessionStore.clear("expired");
          throw new ApiError({ kind: "session", status: 401 });
        }
        throw retryError;
      }
    }
  } finally {
    done();
  }
}

/** Reads a binary body; error responses still arrive as JSON envelopes. */
const readBlob: Reader<Blob> = async (res) => {
  if (!res.ok) return unwrapResponse<never>(res);
  return res.blob();
};

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, "body">) =>
    request("GET", path, opts ?? {}, unwrapResponse<T>),
  getPage: <T>(path: string, opts?: Omit<RequestOptions, "body">) =>
    request("GET", path, opts ?? {}, unwrapPage<T>),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "body">) =>
    request("POST", path, { ...opts, body }, unwrapResponse<T>),
  /** POST to a local route handler that answers with bytes (document viewer). */
  postForBlob: (path: string, body?: unknown, opts?: Omit<RequestOptions, "body" | "local">) =>
    request("POST", path, { ...opts, body, local: true }, readBlob),
};

export type { Page };
