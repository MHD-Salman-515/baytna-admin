"use client";

import { useI18n } from "@/lib/i18n";
import { formatNumber } from "@/lib/i18n/format";
import { Button } from "./button";

export function Pagination({
  page,
  pages,
  total,
  onChange,
  disabled,
}: {
  page: number;
  pages: number;
  total?: number;
  onChange: (page: number) => void;
  disabled?: boolean;
}) {
  const { t, locale } = useI18n();
  const last = Math.max(1, pages);
  return (
    <nav className="flex items-center justify-between gap-3 border-t border-border px-3 py-2 text-xs text-muted">
      <span>{total !== undefined && t("common.total", { count: formatNumber(total, locale) })}</span>
      <div className="flex items-center gap-2">
        <Button size="sm" disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>
          {t("common.previous")}
        </Button>
        <span>
          {t("common.pageOf", { page: formatNumber(page, locale), pages: formatNumber(last, locale) })}
        </span>
        <Button size="sm" disabled={disabled || page >= last} onClick={() => onChange(page + 1)}>
          {t("common.next")}
        </Button>
      </div>
    </nav>
  );
}
