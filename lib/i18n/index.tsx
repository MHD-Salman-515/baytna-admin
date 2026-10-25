"use client";

// Dictionary-based i18n. Arabic (RTL) is the default; English is secondary.
// The choice is a per-browser preference, so it lives in localStorage and is
// applied to <html lang dir> on the client.

import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ar, type MessageKey, type Messages } from "./messages/ar";
import { en } from "./messages/en";

export type Locale = "ar" | "en";
export const DEFAULT_LOCALE: Locale = "ar";

const dictionaries: Record<Locale, Messages> = { ar, en };
const STORAGE_KEY = "baytna.locale";

export function dirFor(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

type I18nValue = { locale: Locale; setLocale: (l: Locale) => void; t: Translate };

const I18nContext = createContext<I18nValue | null>(null);

function readStoredLocale(): Locale {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "en" || v === "ar" ? v : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const stored = readStoredLocale();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync from storage after hydration
    if (stored !== DEFAULT_LOCALE) setLocaleState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dirFor(locale);
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // storage unavailable (private mode); the choice lasts for this tab only
    }
  }, []);

  const value = useMemo<I18nValue>(() => {
    const dict = dictionaries[locale];
    const t: Translate = (key, vars) => {
      const template = dict[key] ?? ar[key] ?? key;
      if (!vars) return template;
      return template.replace(/\{(\w+)\}/g, (m, name: string) =>
        name in vars ? String(vars[name]) : m,
      );
    };
    return { locale, setLocale, t };
  }, [locale, setLocale]);

  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): I18nValue {
  const ctx = use(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

export function useT(): Translate {
  return useI18n().t;
}

export type { MessageKey };
