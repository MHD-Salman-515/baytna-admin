import type { RequestOtpDto } from "@/lib/api/types";
import { backendFetch, fail, failFrom, isCrossSite, ok } from "@/lib/server/backend";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (isCrossSite(request)) return fail(403, "Cross-site request rejected", "Forbidden");
  let body: Partial<RequestOtpDto>;
  try {
    body = await request.json();
  } catch {
    return fail(400, "Invalid JSON", "Bad Request");
  }
  try {
    const data = await backendFetch<unknown>("/auth/otp/request", {
      method: "POST",
      body: { countryId: body.countryId, phone: body.phone },
    });
    return ok(data);
  } catch (e) {
    return failFrom(e);
  }
}
