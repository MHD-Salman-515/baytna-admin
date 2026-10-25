// Single-flight session refresh.
//
// The backend rotates refresh tokens and has reuse detection: if two refresh
// calls present the same token, it revokes EVERY session for that user. So:
//   1. Within a tab, concurrent callers share one in-flight promise.
//   2. Across tabs, the Web Locks API serialises refreshes; each tab's call
//      then carries the cookie the previous one rotated, which is legitimate.

import { fetchWithTimeout, unwrapResponse } from "@/lib/api/envelope";
import { ApiError } from "@/lib/api/errors";
import { REQUEST_TIMEOUT_MS } from "@/lib/env";
import { trackRequest } from "@/lib/api/activity";
import { sessionStore, type Session } from "./session";

let inflight: Promise<Session> | null = null;

const LOCK_NAME = "baytna-admin:auth-refresh";

async function withCrossTabLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return navigator.locks.request(LOCK_NAME, fn);
  }
  return fn();
}

async function callRefresh(): Promise<Session> {
  const done = trackRequest();
  try {
    const res = await fetchWithTimeout(
      "/api/auth/refresh",
      { method: "POST", credentials: "same-origin", cache: "no-store" },
      REQUEST_TIMEOUT_MS,
    );
    return await unwrapResponse<Session>(res);
  } finally {
    done();
  }
}

/**
 * Refreshes the session once, however many callers ask at the same time.
 * A definitive failure (401/403) clears the session; transient failures
 * (server asleep, network) propagate without logging the user out.
 */
export function refreshSession(): Promise<Session> {
  if (inflight) return inflight;
  inflight = withCrossTabLock(callRefresh)
    .then((session) => {
      sessionStore.setSession(session);
      return session;
    })
    .catch((e: unknown) => {
      if (e instanceof ApiError && e.kind === "http" && (e.status === 401 || e.status === 403)) {
        sessionStore.clear(e.code === "NotAdmin" ? "not_admin" : "expired");
        throw new ApiError({ kind: "session", status: e.status, code: e.code });
      }
      throw e;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function isRefreshing(): boolean {
  return inflight !== null;
}
