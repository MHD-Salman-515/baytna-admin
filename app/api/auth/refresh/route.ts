import { ApiError } from "@/lib/api/errors";
import { fetchMe, isAdmin, publicUser, revoke, rotate } from "@/lib/server/auth";
import { fail, failFrom, isCrossSite, ok } from "@/lib/server/backend";
import { clearRefreshToken, readRefreshToken, writeRefreshToken } from "@/lib/server/session-cookie";

export const maxDuration = 60;

// Rotates the refresh cookie and returns a fresh access token plus the user.
// Also used to bootstrap a session after a page load. The browser guarantees
// only one of these is in flight at a time (see lib/auth/refresh.ts).
export async function POST(request: Request) {
  if (isCrossSite(request)) return fail(403, "Cross-site request rejected", "Forbidden");

  const current = await readRefreshToken();
  if (!current) return fail(401, "No session", "Unauthorized");

  let tokens;
  try {
    tokens = await rotate(current);
  } catch (e) {
    // A definitive rejection ends the session; a transport failure keeps the
    // cookie so the next attempt can succeed once the server is awake.
    if (e instanceof ApiError && e.kind === "http" && e.status < 500) await clearRefreshToken();
    return failFrom(e);
  }

  // The old token is spent now; persist the rotated one before anything else can fail.
  await writeRefreshToken(tokens.refreshToken);

  let user;
  try {
    user = await fetchMe(tokens.accessToken);
  } catch (e) {
    return failFrom(e);
  }

  if (!isAdmin(user)) {
    await revoke(tokens.refreshToken);
    await clearRefreshToken();
    return fail(403, "This account is not an admin", "NotAdmin");
  }

  return ok({ accessToken: tokens.accessToken, user: publicUser(user) });
}
