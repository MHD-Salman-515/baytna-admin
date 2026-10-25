"use client";

import { useSyncExternalStore } from "react";
import { sessionStore } from "./session";

export function useSessionState() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getState, sessionStore.getState);
}

/** The signed-in admin. Only valid inside the (admin) layout, behind AdminGate. */
export function useAdmin() {
  const state = useSessionState();
  if (state.status !== "authenticated") throw new Error("useAdmin used outside an authenticated area");
  return state.session.user;
}
