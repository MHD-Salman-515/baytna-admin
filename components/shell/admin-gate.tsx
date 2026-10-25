"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { isApiError } from "@/lib/api/errors";
import { refreshSession } from "@/lib/auth/refresh";
import { useSessionState } from "@/lib/auth/use-session";
import { useT } from "@/lib/i18n";
import { ErrorState, WakingBanner } from "@/components/ui/states";
import { Spinner } from "@/components/ui/skeleton";

/**
 * Establishes the session for the admin area and enforces the ADMIN role.
 * /api/auth/refresh only returns a session for ADMIN users; anything else
 * (no cookie, expired, non-admin) lands on /login with a reason.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const t = useT();
  const router = useRouter();
  const queryClient = useQueryClient();
  const state = useSessionState();
  const [bootError, setBootError] = useState<unknown>(null);

  const boot = useCallback(() => {
    setBootError(null);
    refreshSession().catch((e: unknown) => {
      // Session errors flip the store to anonymous (handled below); anything
      // else (server asleep, network) is shown here with a retry.
      if (!(isApiError(e) && e.kind === "session")) setBootError(e);
    });
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot session bootstrap
    if (state.status === "unknown") boot();
  }, [state.status, boot]);

  useEffect(() => {
    if (state.status !== "anonymous") return;
    // Drop every cached admin response before leaving.
    queryClient.clear();
    const reason = state.reason === "manual" ? "logged_out" : (state.reason ?? "expired");
    router.replace(`/login?reason=${reason}`);
  }, [state, queryClient, router]);

  if (state.status === "authenticated") return <>{children}</>;

  return (
    <div className="flex min-h-screen flex-col">
      <WakingBanner />
      <div className="flex flex-1 items-center justify-center">
        {bootError ? (
          <ErrorState error={bootError} onRetry={boot} />
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Spinner />
            {t("gate.checking")}
          </div>
        )}
      </div>
    </div>
  );
}
