"use client";

import { useT } from "@/lib/i18n";
import { ErrorState } from "@/components/ui/states";

// Boundary for admin pages: the shell stays, the page shows a retryable error.
export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useT();
  return (
    <div className="rounded-lg border border-border bg-surface">
      <h1 className="border-b border-border px-4 py-3 text-sm font-semibold">{t("errors.pageTitle")}</h1>
      <ErrorState error={error} onRetry={retry} />
    </div>
  );
}
