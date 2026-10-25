import "server-only";

import type { AuthUser, RefreshResponse } from "@/lib/api/types";
import { backendFetch } from "./backend";

export function isAdmin(user: Pick<AuthUser, "roles"> | null | undefined): boolean {
  return Array.isArray(user?.roles) && user.roles.includes("ADMIN");
}

/** Only these fields leave the server; the browser has no use for the rest. */
export function publicUser(user: AuthUser): AuthUser {
  return {
    id: user.id,
    phone: user.phone,
    roles: user.roles,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
  };
}

export function rotate(refreshToken: string): Promise<RefreshResponse> {
  return backendFetch<RefreshResponse>("/auth/refresh", { method: "POST", body: { refreshToken } });
}

export function fetchMe(accessToken: string): Promise<AuthUser> {
  return backendFetch<AuthUser>("/auth/me", { accessToken });
}

/** Revokes a refresh token. Best effort: failure must never block a logout. */
export async function revoke(refreshToken: string): Promise<void> {
  try {
    await backendFetch<void>("/auth/logout", { method: "POST", body: { refreshToken } });
  } catch {
    // already invalid or server unreachable; the cookie is cleared regardless
  }
}
