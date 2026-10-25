"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api/client";
import type { Country } from "@/lib/api/types";
import { fetchDevOtp, requestOtp, verifyOtp } from "@/lib/auth/actions";
import { useI18n, type MessageKey, type Translate } from "@/lib/i18n";
import { localized } from "@/lib/i18n/format";
import { classifyOtpError, type OtpErrorKind } from "@/features/auth/otp-errors";
import { useCountdown } from "@/features/auth/use-countdown";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Ltr } from "@/components/ui/ltr";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, WakingBanner, describeError } from "@/components/ui/states";

const RESEND_SECONDS = 60;
const DEV = process.env.NODE_ENV !== "production";

const REASONS: Record<string, MessageKey> = {
  expired: "login.expired",
  not_admin: "login.notAdmin",
  logged_out: "login.loggedOut",
};

function toE164(country: Country, phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (phone.trim().startsWith("+")) return `+${digits}`;
  return `${country.phonePrefix}${digits.replace(/^0+/, "")}`;
}

function otpMessage(err: OtpErrorKind, t: Translate): string {
  switch (err.kind) {
    case "wrong_code":
      return t("login.wrongCode");
    case "expired_code":
      return t("login.expiredCode");
    case "too_many_attempts":
      return t("login.tooManyAttempts");
    case "cooldown":
      return err.seconds ? t("login.cooldownSeconds", { seconds: err.seconds }) : t("login.cooldown");
    case "invalid_phone":
      return t("login.invalidPhone");
    case "not_admin":
      return t("login.notAdmin");
    case "other":
      return describeError(err.error, t);
  }
}

export function LoginForm({ devOtp }: { devOtp: boolean }) {
  const { t, locale, setLocale } = useI18n();
  const router = useRouter();
  const reason = useSearchParams().get("reason");

  const countries = useQuery({
    queryKey: ["countries"],
    queryFn: ({ signal }) => api.get<Country[]>("/countries", { auth: false, signal }),
    staleTime: Infinity,
  });

  const [countryId, setCountryId] = useState("");
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<OtpErrorKind | null>(null);
  const [devBusy, setDevBusy] = useState(false);
  const [devFailed, setDevFailed] = useState(false);

  const activeCountries = (countries.data ?? []).filter((c) => c.isActive);
  const selectedId = countryId || activeCountries.find((c) => c.code === "SY")?.id || activeCountries[0]?.id || "";
  const country = activeCountries.find((c) => c.id === selectedId);

  const { secondsLeft, start: startCountdown } = useCountdown();

  // Too many attempts locks the code; the admin must request a new one.
  const codeLocked = error?.kind === "too_many_attempts" || error?.kind === "expired_code";

  async function sendCode() {
    if (!country) return;
    setBusy(true);
    setError(null);
    try {
      await requestOtp({ countryId: country.id, phone: phone.trim() });
      setStep("code");
      setCode("");
      startCountdown(RESEND_SECONDS);
    } catch (e) {
      const kind = classifyOtpError(e);
      setError(kind);
      if (kind.kind === "cooldown") {
        startCountdown(kind.seconds ?? RESEND_SECONDS);
      }
    } finally {
      setBusy(false);
    }
  }

  async function onSubmitPhone(e: FormEvent) {
    e.preventDefault();
    await sendCode();
  }

  async function onSubmitCode(e: FormEvent) {
    e.preventDefault();
    if (!country || code.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      await verifyOtp({ countryId: country.id, phone: phone.trim(), code });
      router.replace("/dashboard");
    } catch (err) {
      setError(classifyOtpError(err));
      setCode("");
      setBusy(false);
    }
  }

  async function devFill() {
    if (!country) return;
    setDevBusy(true);
    setDevFailed(false);
    try {
      const value = await fetchDevOtp(toE164(country, phone));
      if (value) setCode(value);
      else setDevFailed(true);
    } catch {
      setDevFailed(true);
    } finally {
      setDevBusy(false);
    }
  }

  const reasonKey = reason ? REASONS[reason] : undefined;

  return (
    <div className="w-full max-w-sm overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
      <WakingBanner />
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div>
          <p className="text-lg font-bold text-accent">{t("app.name")}</p>
          <p className="text-xs text-muted">{t("app.console")}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setLocale(locale === "ar" ? "en" : "ar")}>
          {t("common.language")}
        </Button>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <div>
          <h1 className="text-base font-semibold">{t("login.title")}</h1>
          <p className="text-sm text-muted">{t("login.subtitle")}</p>
        </div>

        {reasonKey && !error && (
          <p
            role="status"
            className={`rounded-md px-3 py-2 text-sm ${
              reason === "not_admin" ? "bg-danger-soft text-danger" : "bg-info-soft text-info"
            }`}
          >
            {t(reasonKey)}
          </p>
        )}

        {error && (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
            {otpMessage(error, t)}
          </p>
        )}

        {countries.isPending ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        ) : countries.isError ? (
          <ErrorState error={countries.error} onRetry={() => countries.refetch()} />
        ) : step === "phone" ? (
          <form onSubmit={onSubmitPhone} className="flex flex-col gap-3">
            <Field label={t("login.country")} htmlFor="country">
              <Select id="country" value={selectedId} onChange={(e) => setCountryId(e.target.value)}>
                {activeCountries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {localized(c.name, locale)} ({c.phonePrefix})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("login.phone")} htmlFor="phone">
              <Input
                id="phone"
                dir="ltr"
                inputMode="tel"
                autoComplete="tel"
                placeholder={t("login.phonePlaceholder")}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="text-start"
                required
              />
            </Field>
            <Button
              type="submit"
              variant="primary"
              loading={busy}
              disabled={!phone.trim() || secondsLeft > 0}
            >
              {secondsLeft > 0 ? t("login.resendIn", { seconds: secondsLeft }) : t("login.sendCode")}
            </Button>
          </form>
        ) : (
          <form onSubmit={onSubmitCode} className="flex flex-col gap-3">
            <p className="text-sm text-muted">
              {t("login.codeSentTo")}{" "}
              <Ltr className="font-medium text-fg">{country ? toE164(country, phone) : phone}</Ltr>
            </p>
            <Field label={t("login.code")} htmlFor="code">
              <Input
                id="code"
                dir="ltr"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                disabled={codeLocked}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="text-center text-lg tracking-[0.5em]"
                autoFocus
              />
            </Field>
            <Button
              type="submit"
              variant="primary"
              loading={busy}
              disabled={code.length !== 6 || codeLocked}
            >
              {t("login.verify")}
            </Button>
            {DEV && devOtp && (
              <Button size="sm" variant="ghost" onClick={devFill} loading={devBusy}>
                {t("login.devFill")}
              </Button>
            )}
            {DEV && devFailed && <p className="text-xs text-danger">{t("login.devFillFailed")}</p>}
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                className="text-muted underline-offset-2 hover:underline"
                onClick={() => {
                  setStep("phone");
                  setError(null);
                }}
              >
                {t("login.changePhone")}
              </button>
              <button
                type="button"
                className="text-accent underline-offset-2 hover:underline disabled:text-muted disabled:no-underline"
                disabled={secondsLeft > 0 || busy}
                onClick={sendCode}
              >
                {secondsLeft > 0 ? t("login.resendIn", { seconds: secondsLeft }) : t("login.resend")}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
