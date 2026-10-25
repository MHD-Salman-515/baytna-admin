// In-memory session for the browser tab. The access token never touches
// storage; the refresh token is an httpOnly cookie handled by /api/auth/*.

import type { AuthUser } from "@/lib/api/types";

export type Session = { accessToken: string; user: AuthUser };
export type LogoutReason = "expired" | "not_admin" | "manual";

type State =
  | { status: "unknown" } // not bootstrapped yet
  | { status: "authenticated"; session: Session }
  | { status: "anonymous"; reason?: LogoutReason };

let state: State = { status: "unknown" };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export const sessionStore = {
  getState: (): State => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  setSession(session: Session) {
    state = { status: "authenticated", session };
    emit();
  },
  clear(reason?: LogoutReason) {
    state = { status: "anonymous", reason };
    emit();
  },
  accessToken(): string | undefined {
    return state.status === "authenticated" ? state.session.accessToken : undefined;
  },
};

/** Seconds until the JWT's `exp`, or 0 if it can't be read. Not a verification. */
export function secondsUntilExpiry(token: string): number {
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    return json.exp ? json.exp - Date.now() / 1000 : 0;
  } catch {
    return 0;
  }
}
