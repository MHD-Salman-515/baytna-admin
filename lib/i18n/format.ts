// Locale-aware helpers for backend data. The backend sends user-facing text as
// { ar, en }; resolve it here and nowhere else.

import type { Locale } from "./index";
import type { LocalizedText } from "@/lib/api/types";

export function localized(text: LocalizedText | null | undefined, locale: Locale): string {
  if (!text) return "";
  const other: Locale = locale === "ar" ? "en" : "ar";
  return text[locale]?.trim() || text[other]?.trim() || "";
}

// Latin digits in both locales: phone numbers, IDs and counts must be
// unambiguous for operators copying them between systems.
const numberLocale = (locale: Locale) => (locale === "ar" ? "ar-u-nu-latn" : "en");

export function formatNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(numberLocale(locale)).format(n);
}

export function formatPercent(ratio: number, locale: Locale): string {
  return new Intl.NumberFormat(numberLocale(locale), {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(ratio);
}

export function formatDate(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(numberLocale(locale), { dateStyle: "medium" }).format(d);
}

export function formatDateTime(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(numberLocale(locale), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d);
}
