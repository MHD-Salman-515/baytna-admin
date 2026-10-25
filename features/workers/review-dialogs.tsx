"use client";

import { useState, type FormEvent } from "react";
import type { LocalizedText } from "@/lib/api/types";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { describeError } from "@/components/ui/states";

/**
 * Collects a localized reason. Arabic is required (the worker-facing language);
 * English is optional. Used for document rejection and worker reject/suspend.
 */
export function ReasonDialog({
  open,
  title,
  confirmLabel,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  confirmLabel: string;
  pending: boolean;
  error: unknown;
  onConfirm: (reason: LocalizedText) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [ar, setAr] = useState("");
  const [en, setEn] = useState("");
  const [touched, setTouched] = useState(false);
  const missing = ar.trim().length === 0;

  const close = () => {
    setAr("");
    setEn("");
    setTouched(false);
    onClose();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (missing) return;
    onConfirm(en.trim() ? { ar: ar.trim(), en: en.trim() } : { ar: ar.trim() });
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      footer={
        <>
          <Button onClick={close} disabled={pending}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" type="submit" form="reason-form" loading={pending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <form id="reason-form" onSubmit={submit} className="flex flex-col gap-3">
        <Field
          label={t("worker.reasonAr")}
          htmlFor="reason-ar"
          error={touched && missing ? t("worker.reasonRequired") : undefined}
        >
          <Textarea id="reason-ar" dir="rtl" lang="ar" value={ar} onChange={(e) => setAr(e.target.value)} autoFocus />
        </Field>
        <Field label={t("worker.reasonEn")} htmlFor="reason-en">
          <Textarea id="reason-en" dir="ltr" lang="en" value={en} onChange={(e) => setEn(e.target.value)} />
        </Field>
        {error != null && (
          <p role="alert" className="text-sm text-danger">
            {describeError(error, t)}
          </p>
        )}
      </form>
    </Modal>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  pending: boolean;
  error: unknown;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button onClick={onClose} disabled={pending}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={onConfirm} loading={pending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm">{body}</p>
      {error != null && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {describeError(error, t)}
        </p>
      )}
    </Modal>
  );
}
