import "server-only";

import { cookies } from "next/headers";

// The refresh token lives only in this httpOnly cookie. JavaScript in the
// browser never sees it; the access token is kept in memory only.
export const REFRESH_COOKIE = "baytna_rt";

// Matches the backend's refresh-token lifetime closely enough; the backend is
// the source of truth and rejects expired tokens regardless.
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export async function readRefreshToken(): Promise<string | undefined> {
  return (await cookies()).get(REFRESH_COOKIE)?.value;
}

export async function writeRefreshToken(token: string): Promise<void> {
  (await cookies()).set(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearRefreshToken(): Promise<void> {
  (await cookies()).delete(REFRESH_COOKIE);
}
