"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { logout } from "@/lib/auth/actions";
import { useAdmin } from "@/lib/auth/use-session";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Ltr } from "@/components/ui/ltr";
import { WakingBanner } from "@/components/ui/states";

type NavItem = { href: string; label: MessageKey; ready: boolean };

// Screens not built yet stay visible but disabled, so the map of the console is clear.
const NAV: NavItem[] = [
  { href: "/dashboard", label: "nav.dashboard", ready: true },
  { href: "/workers", label: "nav.workers", ready: true },
  { href: "/bookings", label: "nav.bookings", ready: false },
  { href: "/reports", label: "nav.reports", ready: false },
  { href: "/panic-alerts", label: "nav.panic", ready: false },
  { href: "/wallets", label: "nav.wallets", ready: false },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { t, locale, setLocale } = useI18n();
  const admin = useAdmin();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const onLogout = async () => {
    setLoggingOut(true);
    await logout("manual").catch(() => undefined);
  };

  return (
    <div className="flex min-h-screen">
      <aside
        className={`fixed inset-y-0 start-0 z-30 w-56 shrink-0 border-e border-border bg-surface transition-transform md:static ${
          menuOpen ? "" : "max-md:ltr:-translate-x-full max-md:rtl:translate-x-full"
        }`}
      >
        <div className="flex h-12 items-center gap-2 border-b border-border px-4">
          <span className="text-base font-bold text-accent">{t("app.name")}</span>
          <span className="text-xs text-muted">{t("app.console")}</span>
        </div>
        <nav className="flex flex-col gap-0.5 p-2 text-sm">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            if (!item.ready) {
              return (
                <span
                  key={item.href}
                  aria-disabled
                  className="flex items-center justify-between rounded-md px-3 py-1.5 text-muted/60"
                >
                  {t(item.label)}
                  <span className="text-[10px]">{t("nav.soon")}</span>
                </span>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 ${
                  active ? "bg-accent-soft font-medium text-accent" : "text-fg hover:bg-surface-2"
                }`}
              >
                {t(item.label)}
              </Link>
            );
          })}
        </nav>
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setMenuOpen(false)} aria-hidden />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-12 items-center justify-between gap-3 border-b border-border bg-surface px-4">
          <button
            type="button"
            className="rounded p-1 text-muted hover:bg-surface-2 md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={t("header.menu")}
          >
            <svg viewBox="0 0 20 20" className="size-5" aria-hidden>
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <div className="ms-auto flex items-center gap-3 text-sm">
            <span className="hidden text-xs text-muted sm:inline">{t("header.signedInAs")}</span>
            <Ltr className="font-medium">{admin.phone}</Ltr>
            <Button size="sm" variant="ghost" onClick={() => setLocale(locale === "ar" ? "en" : "ar")}>
              {t("common.language")}
            </Button>
            <Button size="sm" onClick={onLogout} loading={loggingOut}>
              {t("header.logout")}
            </Button>
          </div>
        </header>
        <WakingBanner />
        <main className="min-w-0 flex-1 p-4">{children}</main>
      </div>
    </div>
  );
}
