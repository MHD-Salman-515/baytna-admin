"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useDashboard } from "@/features/dashboard/queries";
import { BOOKING_STATUSES } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";
import { formatDateTime, formatNumber, formatPercent } from "@/lib/i18n/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, EmptyState, ErrorState } from "@/components/ui/states";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";

type Tone = "neutral" | "warning" | "danger";

const toneClass: Record<Tone, string> = {
  neutral: "text-fg",
  warning: "text-warning",
  danger: "text-danger",
};

function Stat({
  label,
  value,
  detail,
  href,
  tone = "neutral",
}: {
  label: string;
  value: string;
  detail?: ReactNode;
  href?: string;
  tone?: Tone;
}) {
  const body = (
    <>
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass[tone]}`}>{value}</p>
      {detail && <p className="mt-0.5 text-xs text-muted">{detail}</p>}
    </>
  );
  const cls = "block rounded-lg border border-border bg-surface p-3";
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:border-accent hover:bg-accent-soft/40`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const { data, error, isPending, refetch, isFetching, dataUpdatedAt } = useDashboard();
  const n = (v: number) => formatNumber(v, locale);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">{t("dashboard.title")}</h1>
        <div className="flex items-center gap-3 text-xs text-muted">
          {dataUpdatedAt > 0 && (
            <span>{t("dashboard.generatedAt", { time: formatDateTime(new Date(dataUpdatedAt).toISOString(), locale) })}</span>
          )}
          <Button size="sm" onClick={() => refetch()} loading={isFetching && !isPending}>
            {t("dashboard.refresh")}
          </Button>
        </div>
      </div>

      {isPending ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <ErrorState error={error} onRetry={() => refetch()} />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Stat
              label={t("dashboard.pendingVerifications")}
              value={n(data.pendingVerifications)}
              href="/workers?status=PENDING_REVIEW"
              tone={data.pendingVerifications > 0 ? "warning" : "neutral"}
            />
            {/* No reports / panic / wallet screens yet, so these are not links. */}
            <Stat label={t("dashboard.openReports")} value={n(data.openReports)} />
            <Stat
              label={t("dashboard.unresolvedPanic")}
              value={n(data.unresolvedPanicAlerts)}
              tone={data.unresolvedPanicAlerts > 0 ? "danger" : "neutral"}
            />
            <Stat
              label={t("dashboard.lowBalance")}
              value={n(data.workersBelowLowBalanceThreshold)}
              tone={data.workersBelowLowBalanceThreshold > 0 ? "warning" : "neutral"}
            />
            <Stat
              label={t("dashboard.instantFailure")}
              value={formatPercent(data.instantMatchingFailureRate.ratePercent / 100, locale)}
              detail={t("dashboard.instantFailureDetail", {
                failed: n(data.instantMatchingFailureRate.noWorkerFound),
                total: n(data.instantMatchingFailureRate.totalInstant),
              })}
            />
          </div>

          <Card title={t("dashboard.bookingsByStatus")}>
            {(() => {
              const rows = BOOKING_STATUSES.filter(
                (s) => (data.bookingsToday[s] ?? 0) > 0 || (data.bookingsThisWeek[s] ?? 0) > 0,
              );
              if (rows.length === 0) return <EmptyState title={t("dashboard.noBookings")} />;
              return (
                <Table>
                  <THead>
                    <tr>
                      <TH>{t("workers.colStatus")}</TH>
                      <TH className="text-end">{t("dashboard.today")}</TH>
                      <TH className="text-end">{t("dashboard.week")}</TH>
                    </tr>
                  </THead>
                  <tbody>
                    {rows.map((s) => (
                      <TR key={s}>
                        <TD>{t(`booking.${s}`)}</TD>
                        <TD className="text-end tabular-nums">{n(data.bookingsToday[s] ?? 0)}</TD>
                        <TD className="text-end tabular-nums">{n(data.bookingsThisWeek[s] ?? 0)}</TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              );
            })()}
          </Card>
        </>
      )}
    </div>
  );
}
