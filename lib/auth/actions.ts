// Browser calls to the Next.js auth proxy (/api/auth/*). These are the only
// requests that touch the refresh cookie.

import { trackRequest } from "@/lib/api/activity";
import { fetchWithTimeout, unwrapResponse } from "@/lib/api/envelope";
import type { RequestOtpDto, VerifyOtpDto } from "@/lib/api/types";
import { REQUEST_TIMEOUT_MS } from "@/lib/env";
import { sessionStore, type LogoutReason, type Session } from "./session";

async function postLocal<T>(path: string, body?: unknown): Promise<T> {
  const done = trackRequest();
  try {
    const res = await fetchWithTimeout(
      path,
      {
        method: "POST",
        headers: body === undefined ? undefined : { "content-type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: "same-origin",
        cache: "no-store",
      },
      REQUEST_TIMEOUT_MS,
    );
    return await unwrapResponse<T>(res);
  } finally {
    done();
  }
}

export function requestOtp(dto: RequestOtpDto): Promise<unknown> {
  return postLocal("/api/auth/otp/request", dto);
}

export async function verifyOtp(dto: VerifyOtpDto): Promise<Session> {
  const session = await postLocal<Session>("/api/auth/otp/verify", dto);
  sessionStore.setSession(session);
  return session;
}

export async function logout(reason: LogoutReason = "manual"): Promise<void> {
  try {
    await postLocal("/api/auth/logout");
  } finally {
    sessionStore.clear(reason);
  }
}

/** Dev only: the route doesn't exist in production builds. */
export async function fetchDevOtp(e164: string): Promise<string | null> {
  const res = await fetchWithTimeout(
    `/api/dev/otp?phone=${encodeURIComponent(e164)}`,
    { cache: "no-store", credentials: "same-origin" },
    REQUEST_TIMEOUT_MS,
  );
  return (await unwrapResponse<{ code: string | null }>(res)).code;
}
