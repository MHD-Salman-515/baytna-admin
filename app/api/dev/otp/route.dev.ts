// DEVELOPMENT ONLY. This file is a route only under `next dev` (see
// pageExtensions in next.config.ts), so it does not exist in production builds.
// It reads the last OTP sent to a phone from the backend's dev endpoint, using
// DEV_OTP_KEY from .env.local, which never reaches the browser.

import { API_BASE_URL } from "@/lib/env";
import { fail, failFrom, isCrossSite, ok } from "@/lib/server/backend";
import { fetchWithTimeout, unwrapResponse } from "@/lib/api/envelope";

export async function GET(request: Request) {
  const key = process.env.DEV_OTP_KEY;
  if (process.env.NODE_ENV === "production" || !key) return fail(404, "Not Found", "Not Found");
  if (isCrossSite(request)) return fail(403, "Cross-site request rejected", "Forbidden");

  const phone = new URL(request.url).searchParams.get("phone");
  if (!phone || !/^\+\d{8,15}$/.test(phone)) return fail(400, "phone must be E.164", "Bad Request");

  try {
    const res = await fetchWithTimeout(
      `${API_BASE_URL}/dev/last-otp?phone=${encodeURIComponent(phone)}`,
      { headers: { "x-dev-otp-key": key }, cache: "no-store" },
      60_000,
    );
    const data = await unwrapResponse<{ code?: string }>(res);
    return ok({ code: data?.code ?? null });
  } catch (e) {
    return failFrom(e);
  }
}
