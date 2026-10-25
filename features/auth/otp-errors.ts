import { ApiError } from "@/lib/api/errors";

export type OtpErrorKind =
  | { kind: "wrong_code" }
  | { kind: "expired_code" }
  | { kind: "too_many_attempts" }
  | { kind: "cooldown"; seconds?: number }
  | { kind: "invalid_phone" }
  | { kind: "not_admin" }
  | { kind: "other"; error: unknown };

/**
 * Maps backend OTP failures to distinct UI states. The backend signals these
 * with status codes plus English messages, so we match on both.
 */
export function classifyOtpError(e: unknown): OtpErrorKind {
  if (!(e instanceof ApiError) || e.kind !== "http") return { kind: "other", error: e };
  if (e.code === "NotAdmin") return { kind: "not_admin" };

  const text = e.messages.join(" ").toLowerCase();
  const seconds = Number(/(\d+)\s*s(?:ec|econds?)?\b/.exec(text)?.[1]) || undefined;

  if (/too many|attempts|locked/.test(text)) return { kind: "too_many_attempts" };
  if (e.status === 429 || /wait|cooldown|recently|too soon|retry after/.test(text)) {
    return { kind: "cooldown", seconds };
  }
  if (/expired|no active|not found|request a new/.test(text)) return { kind: "expired_code" };
  if (/invalid code|incorrect|wrong|invalid otp|does not match/.test(text)) return { kind: "wrong_code" };
  if (/phone/.test(text) && e.status === 400) return { kind: "invalid_phone" };
  if (e.status === 401) return { kind: "wrong_code" };
  return { kind: "other", error: e };
}
