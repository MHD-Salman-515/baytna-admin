import type { VerifyOtpDto, VerifyOtpResponse } from "@/lib/api/types";
import { isAdmin, publicUser, revoke } from "@/lib/server/auth";
import { backendFetch, fail, failFrom, isCrossSite, ok } from "@/lib/server/backend";
import { writeRefreshToken } from "@/lib/server/session-cookie";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (isCrossSite(request)) return fail(403, "Cross-site request rejected", "Forbidden");
  let body: Partial<VerifyOtpDto>;
  try {
    body = await request.json();
  } catch {
    return fail(400, "Invalid JSON", "Bad Request");
  }

  let result: VerifyOtpResponse;
  try {
    result = await backendFetch<VerifyOtpResponse>("/auth/otp/verify", {
      method: "POST",
      body: { countryId: body.countryId, phone: body.phone, code: body.code },
    });
  } catch (e) {
    return failFrom(e);
  }

  // Non-admins get no session at all: revoke what the backend just issued.
  if (!isAdmin(result.user)) {
    await revoke(result.refreshToken);
    return fail(403, "This account is not an admin", "NotAdmin");
  }

  await writeRefreshToken(result.refreshToken);
  return ok({ accessToken: result.accessToken, user: publicUser(result.user) });
}
