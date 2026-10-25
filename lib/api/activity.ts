// Tracks requests that are taking long enough that the staging server is
// probably cold-starting, so the UI can say "waking up" instead of erroring.

import { useSyncExternalStore } from "react";
import { SLOW_REQUEST_MS } from "@/lib/env";

let slowCount = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Call at request start; call the returned function when it settles. */
export function trackRequest(): () => void {
  let slow = false;
  const timer = setTimeout(() => {
    slow = true;
    slowCount++;
    emit();
  }, SLOW_REQUEST_MS);
  return () => {
    clearTimeout(timer);
    if (slow) {
      slowCount--;
      emit();
    }
  };
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useServerWaking(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => slowCount > 0,
    () => false,
  );
}
