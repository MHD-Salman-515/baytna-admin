"use client";

import type { DocumentStatus, WorkerStatus } from "@/lib/api/types";
import { useT } from "@/lib/i18n";
import { Badge, type Tone } from "@/components/ui/badge";

const workerTone: Record<WorkerStatus, Tone> = {
  DRAFT: "neutral",
  PENDING_REVIEW: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  SUSPENDED: "danger",
};

const docTone: Record<DocumentStatus, Tone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
};

export function WorkerStatusBadge({ status }: { status: WorkerStatus }) {
  const t = useT();
  return <Badge tone={workerTone[status] ?? "neutral"}>{t(`workerStatus.${status}`)}</Badge>;
}

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const t = useT();
  return <Badge tone={docTone[status] ?? "neutral"}>{t(`docStatus.${status}`)}</Badge>;
}
