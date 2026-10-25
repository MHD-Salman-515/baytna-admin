"use client";

import type { ReactNode } from "react";
import { ApiError } from "@/lib/api/errors";
import { useServerWaking } from "@/lib/api/activity";
import { useT, type Translate } from "@/lib/i18n";
import { Button } from "./button";
import { Spinner } from "./skeleton";

/** Turns any thrown value into one human sentence in the current locale. */
export function describeError(e: unknown, t: Translate): string {
  if (e instanceof ApiError) {
    switch (e.kind) {
      case "network":
        return t("errors.network");
      case "timeout":
        return t("errors.timeout");
      case "session":
        return t("errors.sessionExpired");
    }
    if (e.status === 403) return t("errors.forbidden");
    if (e.status === 404) return t("errors.notFound");
    if (e.status >= 500) return t("errors.server", { status: e.status });
    // 4xx validation messages come from the backend in English only.
    if (e.messages.length) return e.messages.join(" · ");
  }
  return t("errors.generic");
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
      <p className="text-sm font-medium text-fg">{title}</p>
      {children && <div className="text-sm text-muted">{children}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useT();
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center"
    >
      <p className="text-sm text-danger">{describeError(error, t)}</p>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}

/** Banner shown while any request has been pending long enough to be a cold start. */
export function WakingBanner() {
  const t = useT();
  const waking = useServerWaking();
  if (!waking) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-3 border-b border-warning/30 bg-warning-soft px-4 py-2.5 text-sm text-warning"
    >
      <Spinner className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-medium">{t("waking.title")}</p>
        <p className="text-xs opacity-90">{t("waking.body")}</p>
      </div>
    </div>
  );
}

export function Card({
  title,
  actions,
  children,
  className = "",
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-border bg-surface ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
          <h2 className="text-sm font-semibold">{title}</h2>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
