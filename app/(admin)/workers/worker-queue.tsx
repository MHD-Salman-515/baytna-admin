"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import { useWorkerList } from "@/features/workers/queries";
import { WorkerStatusBadge } from "@/features/workers/status";
import { useCityNames } from "@/features/reference/queries";
import { WORKER_STATUSES, type WorkerStatus } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";
import { formatDate, formatNumber, localized } from "@/lib/i18n/format";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/field";
import { Ltr } from "@/components/ui/ltr";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Card, EmptyState, ErrorState } from "@/components/ui/states";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";

const ALL = "ALL";
const DEFAULT_STATUS: WorkerStatus = "PENDING_REVIEW";

function parseStatus(v: string | null): WorkerStatus | undefined {
  if (v === ALL) return undefined;
  return (WORKER_STATUSES as readonly string[]).includes(v ?? "") ? (v as WorkerStatus) : DEFAULT_STATUS;
}

export function WorkerQueue() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // Filter and page live in the URL, so the view survives reloads and can be linked.
  const status = parseStatus(params.get("status"));
  const page = Math.max(1, Number(params.get("page")) || 1);
  const cities = useCityNames();
  const { data, error, isPending, isPlaceholderData, refetch } = useWorkerList({ status, page });

  const setParams = useCallback(
    (next: { status?: string; page?: number }) => {
      const sp = new URLSearchParams(params);
      if (next.status !== undefined) {
        sp.set("status", next.status);
        sp.delete("page");
      }
      if (next.page !== undefined) sp.set("page", String(next.page));
      router.replace(`${pathname}?${sp.toString()}`);
    },
    [params, pathname, router],
  );

  // A stale link (or a review that emptied the last page) can point past the end.
  const lastPage = data?.meta.totalPages ?? 1;
  const outOfRange = !isPlaceholderData && data !== undefined && data.meta.total > 0 && page > lastPage;
  useEffect(() => {
    if (outOfRange) setParams({ page: lastPage });
  }, [outOfRange, lastPage, setParams]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-lg font-semibold">{t("workers.title")}</h1>
        <label className="flex items-center gap-2 text-xs text-muted">
          {t("workers.filterStatus")}
          <Select
            aria-label={t("workers.filterStatus")}
            className="w-44"
            value={status ?? ALL}
            onChange={(e) => setParams({ status: e.target.value })}
          >
            {WORKER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`workerStatus.${s}`)}
              </option>
            ))}
            <option value={ALL}>{t("common.all")}</option>
          </Select>
        </label>
      </div>

      <p className="rounded-md bg-info-soft px-3 py-2 text-xs text-info">{t("workers.identityGap")}</p>

      <Card>
        {isPending ? (
          <TableSkeleton cols={6} />
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} />
        ) : data.items.length === 0 ? (
          status === "PENDING_REVIEW" ? (
            <EmptyState title={t("workers.emptyPending")}>{t("workers.emptyPendingHint")}</EmptyState>
          ) : (
            <EmptyState title={t("workers.empty")} />
          )
        ) : (
          <div className={isPlaceholderData ? "opacity-60" : undefined}>
            <Table>
              <THead>
                <tr>
                  <TH>{t("workers.colId")}</TH>
                  <TH>{t("workers.colCity")}</TH>
                  <TH>{t("worker.bio")}</TH>
                  <TH>{t("workers.colExperience")}</TH>
                  <TH>{t("workers.colStatus")}</TH>
                  <TH>{t("workers.colCreated")}</TH>
                  <TH>{t("workers.colReviewed")}</TH>
                </tr>
              </THead>
              <tbody>
                {data.items.map((w) => (
                  <TR key={w.id} className="hover:bg-surface-2">
                    <TD>
                      <Link href={`/workers/${w.id}`} className="font-medium text-accent hover:underline">
                        <Ltr className="font-mono text-xs">{w.id}</Ltr>
                      </Link>
                    </TD>
                    <TD>{localized(cities.get(w.cityId), locale) || <Ltr className="text-xs text-muted">{w.cityId}</Ltr>}</TD>
                    <TD className="max-w-56 truncate text-muted">{localized(w.bio, locale) || t("common.none")}</TD>
                    <TD className="tabular-nums">{t("workers.years", { count: formatNumber(w.yearsOfExperience, locale) })}</TD>
                    <TD>
                      <WorkerStatusBadge status={w.verificationStatus} />
                    </TD>
                    <TD className="whitespace-nowrap text-muted">{formatDate(w.createdAt, locale)}</TD>
                    <TD className="whitespace-nowrap text-muted">{formatDate(w.reviewedAt, locale) || t("common.none")}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </div>
        )}
        {data && (data.meta.total > 0 || data.meta.page > 1) && (
          <Pagination
            page={data.meta.page}
            pages={data.meta.totalPages}
            total={data.meta.total}
            disabled={isPlaceholderData}
            onChange={(p) => setParams({ page: p })}
          />
        )}
      </Card>
    </div>
  );
}
