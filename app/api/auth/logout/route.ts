import { revoke } from "@/lib/server/auth";
import { fail, isCrossSite, ok } from "@/lib/server/backend";
import { clearRefreshToken, readRefreshToken } from "@/lib/server/session-cookie";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (isCrossSite(request)) return fail(403, "Cross-site request rejected", "Forbidden");
  const token = await readRefreshToken();
  await clearRefreshToken();
  if (token) await revoke(token);
  return ok(null);
}
