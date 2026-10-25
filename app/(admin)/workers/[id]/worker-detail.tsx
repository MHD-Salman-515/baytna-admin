"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { DocumentViewerModal, useDocumentViewer } from "@/features/workers/document-viewer";
import { useReviewDocument, useReviewWorker, useWorker360, useWorkerDetail } from "@/features/workers/queries";
import { ConfirmDialog, ReasonDialog } from "@/features/workers/review-dialogs";
import { DocumentStatusBadge, WorkerStatusBadge } from "@/features/workers/status";
import { useCityNames, useCountryNames, useServiceNames } from "@/features/reference/queries";
import type { LocalizedText, WorkerDocument, WorkerProfile } from "@/lib/api/types";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { formatDate, formatDateTime, formatNumber, localized } from "@/lib/i18n/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Ltr } from "@/components/ui/ltr";
import { Skeleton, TableSkeleton } from "@/components/ui/skeleton";
import { Card, EmptyState, ErrorState } from "@/components/ui/states";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";

type WorkerAction = "approve" | "reject" | "suspend";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-1.5 sm:flex-row sm:gap-3">
      <dt className="w-40 shrink-0 text-xs text-muted">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

function formatBytes(n: number, locale: "ar" | "en") {
  if (n < 1024) return `${formatNumber(n, locale)} B`;
  if (n < 1024 * 1024) return `${formatNumber(Math.round(n / 102.4) / 10, locale)} KB`;
  return `${formatNumber(Math.round(n / 104857.6) / 10, locale)} MB`;
}

export function WorkerDetailView() {
  const { t, locale } = useI18n();
  const { id } = useParams<{ id: string }>();
  const detail = useWorkerDetail(id);
  const view360 = useWorker360(id);
  const cities = useCityNames();
  const countries = useCountryNames();
  const services = useServiceNames();
  const viewer = useDocumentViewer(id);

  const reviewDoc = useReviewDocument(id);
  const reviewWorker = useReviewWorker(id);
  const [rejectingDoc, setRejectingDoc] = useState<WorkerDocument | null>(null);
  const [workerAction, setWorkerAction] = useState<WorkerAction | null>(null);
  const [notice, setNotice] = useState<MessageKey | null>(null);

  const docTitle = (d: WorkerDocument) => t(`docType.${d.type}`);

  const approveDoc = (doc: WorkerDocument) => {
    setNotice(null);
    reviewDoc.mutate({ docId: doc.id, action: "approve" }, { onSuccess: () => setNotice("worker.docApproved") });
  };

  const rejectDoc = (reason: LocalizedText) => {
    if (!rejectingDoc) return;
    reviewDoc.mutate(
      { docId: rejectingDoc.id, action: "reject", reason },
      {
        onSuccess: () => {
          setRejectingDoc(null);
          setNotice("worker.docRejected");
        },
      },
    );
  };

  const decide = (action: WorkerAction, reason?: LocalizedText) => {
    reviewWorker.mutate(reason ? { action, reason } : { action }, {
      onSuccess: () => {
        setWorkerAction(null);
        setNotice(action === "approve" ? "worker.approved" : action === "reject" ? "worker.rejected" : "worker.suspended");
      },
    });
  };

  const openAction = (a: WorkerAction) => {
    reviewWorker.reset();
    setNotice(null);
    setWorkerAction(a);
  };

  if (detail.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (detail.error) {
    return (
      <Card>
        <ErrorState error={detail.error} onRetry={() => detail.refetch()} />
      </Card>
    );
  }

  const { profile, documents } = detail.data;
  const unapprovedDocs = documents.filter((d) => d.status !== "APPROVED").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link href="/workers" className="text-xs text-muted hover:text-fg">
            {t("worker.back")}
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">{t("worker.title")}</h1>
            <WorkerStatusBadge status={profile.verificationStatus} />
          </div>
          <Ltr className="font-mono text-xs text-muted">{profile.id}</Ltr>
        </div>
        <DecisionBar profile={profile} pending={reviewWorker.isPending} onAction={openAction} />
      </div>

      {notice && (
        <p role="status" className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">
          {t(notice)}
        </p>
      )}
      <p className="rounded-md bg-info-soft px-3 py-2 text-xs text-info">{t("workers.identityGap")}</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <ProfileCard profile={profile} cities={cities} countries={countries} />

        <Card title={t("worker.documents")}>
          {documents.length === 0 ? (
            <EmptyState title={t("worker.noDocuments")} />
          ) : (
            <ul className="divide-y divide-border">
              {documents.map((doc) => (
                <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{docTitle(doc)}</span>
                      <DocumentStatusBadge status={doc.status} />
                    </div>
                    <span className="text-xs text-muted">
                      <Ltr>{doc.mimeType}</Ltr> · <Ltr>{formatBytes(doc.sizeBytes, locale)}</Ltr> ·{" "}
                      {t("worker.docUploaded", { date: formatDate(doc.createdAt, locale) })}
                      {doc.expiresAt && <> · {t("worker.docExpires", { date: formatDate(doc.expiresAt, locale) })}</>}
                    </span>
                    {doc.status === "REJECTED" && doc.rejectionReason && (
                      <span className="text-xs text-danger">{localized(doc.rejectionReason, locale)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* Fetches the file only on this click: one click, one audited access. */}
                    <Button size="sm" onClick={() => viewer.open(doc)}>
                      {t("worker.view")}
                    </Button>
                    {doc.status !== "APPROVED" && (
                      <Button
                        size="sm"
                        variant="primary"
                        loading={reviewDoc.isPending && reviewDoc.variables?.docId === doc.id && reviewDoc.variables.action === "approve"}
                        disabled={reviewDoc.isPending}
                        onClick={() => approveDoc(doc)}
                      >
                        {t("worker.approveDoc")}
                      </Button>
                    )}
                    {doc.status !== "REJECTED" && (
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={reviewDoc.isPending}
                        onClick={() => {
                          reviewDoc.reset();
                          setNotice(null);
                          setRejectingDoc(doc);
                        }}
                      >
                        {t("worker.rejectDoc")}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {reviewDoc.error && !rejectingDoc && (
            <ErrorState error={reviewDoc.error} />
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("worker.services")}>
          {view360.isPending ? (
            <TableSkeleton rows={2} cols={3} />
          ) : view360.error ? (
            <ErrorState error={view360.error} onRetry={() => view360.refetch()} />
          ) : view360.data.services.length === 0 ? (
            <EmptyState title={t("worker.noServices")} />
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>{t("worker.services")}</TH>
                  <TH>{t("worker.pricing")}</TH>
                  <TH />
                </tr>
              </THead>
              <tbody>
                {view360.data.services.map((s) => (
                  <TR key={s.id}>
                    <TD>{localized(services.get(s.serviceId), locale) || <Ltr className="text-xs">{s.serviceId}</Ltr>}</TD>
                    <TD className="text-muted">
                      {s.hourly
                        ? t("worker.perHour", {
                            rate: formatNumber(s.hourly.rate, locale),
                            currency: s.currency,
                            hours: formatNumber(s.hourly.minHours, locale),
                          })
                        : s.pricingType}
                    </TD>
                    <TD>{!s.isActive && <Badge>{t("worker.inactive")}</Badge>}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card title={t("worker.recentBookings")}>
          {view360.isPending ? (
            <TableSkeleton rows={3} cols={4} />
          ) : view360.error ? (
            <ErrorState error={view360.error} onRetry={() => view360.refetch()} />
          ) : view360.data.recentBookings.length === 0 ? (
            <EmptyState title={t("worker.noBookings")} />
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>{t("worker.bookingNumber")}</TH>
                  <TH>{t("worker.bookingType")}</TH>
                  <TH>{t("workers.colStatus")}</TH>
                  <TH>{t("worker.bookingDate")}</TH>
                  <TH className="text-end">{t("worker.bookingPrice")}</TH>
                </tr>
              </THead>
              <tbody>
                {view360.data.recentBookings.map((b) => (
                  <TR key={b.id}>
                    <TD>
                      <Ltr className="font-mono text-xs">{b.bookingNumber}</Ltr>
                    </TD>
                    <TD>{t(`bookingType.${b.type}`)}</TD>
                    <TD>{t(`booking.${b.status}`)}</TD>
                    <TD className="whitespace-nowrap text-muted">
                      {formatDateTime(b.scheduledFor ?? b.acceptedAt ?? b.cancelledAt, locale) || t("common.none")}
                    </TD>
                    <TD className="text-end tabular-nums">
                      {b.pricing ? `${formatNumber(b.pricing.basePrice, locale)} ${b.pricing.currency}` : t("common.none")}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      <DocumentViewerModal
        state={viewer.state}
        title={viewer.state ? docTitle(viewer.state.doc) : ""}
        onClose={viewer.close}
        onRetry={() => viewer.state && viewer.open(viewer.state.doc)}
      />

      <ReasonDialog
        open={rejectingDoc !== null}
        title={t("worker.rejectDocTitle")}
        confirmLabel={t("worker.rejectDoc")}
        pending={reviewDoc.isPending}
        error={reviewDoc.error}
        onConfirm={rejectDoc}
        onClose={() => setRejectingDoc(null)}
      />
      <ReasonDialog
        open={workerAction === "reject" || workerAction === "suspend"}
        title={t(workerAction === "suspend" ? "worker.suspendTitle" : "worker.rejectTitle")}
        confirmLabel={t(workerAction === "suspend" ? "worker.suspend" : "worker.reject")}
        pending={reviewWorker.isPending}
        error={reviewWorker.error}
        onConfirm={(reason) => workerAction && decide(workerAction, reason)}
        onClose={() => setWorkerAction(null)}
      />
      <ConfirmDialog
        open={workerAction === "approve"}
        title={t("worker.approveTitle")}
        body={[
          t("worker.approveConfirm"),
          unapprovedDocs > 0 ? t("worker.approveDocsPending", { count: formatNumber(unapprovedDocs, locale) }) : "",
        ]
          .filter(Boolean)
          .join(" ")}
        confirmLabel={t("worker.approve")}
        pending={reviewWorker.isPending}
        error={reviewWorker.error}
        onConfirm={() => decide("approve")}
        onClose={() => setWorkerAction(null)}
      />
    </div>
  );
}

function DecisionBar({
  profile,
  pending,
  onAction,
}: {
  profile: WorkerProfile;
  pending: boolean;
  onAction: (a: WorkerAction) => void;
}) {
  const { t } = useI18n();
  const s = profile.verificationStatus;
  return (
    <div className="flex items-center gap-2" aria-label={t("worker.decision")}>
      {s === "PENDING_REVIEW" && (
        <>
          <Button variant="primary" disabled={pending} onClick={() => onAction("approve")}>
            {t("worker.approve")}
          </Button>
          <Button variant="danger" disabled={pending} onClick={() => onAction("reject")}>
            {t("worker.reject")}
          </Button>
        </>
      )}
      {s === "APPROVED" && (
        <Button variant="danger" disabled={pending} onClick={() => onAction("suspend")}>
          {t("worker.suspend")}
        </Button>
      )}
    </div>
  );
}

function ProfileCard({
  profile,
  cities,
  countries,
}: {
  profile: WorkerProfile;
  cities: Map<string, LocalizedText>;
  countries: Map<string, LocalizedText>;
}) {
  const { t, locale } = useI18n();
  const place = (map: Map<string, LocalizedText>, id: string) =>
    localized(map.get(id), locale) || <Ltr className="font-mono text-xs">{id}</Ltr>;
  return (
    <Card title={t("worker.title")}>
      <dl className="divide-y divide-border px-3">
        <Row label={t("worker.profileId")}>
          <Ltr className="font-mono text-xs">{profile.id}</Ltr>
        </Row>
        <Row label={t("worker.userId")}>
          <Ltr className="font-mono text-xs">{profile.userId}</Ltr>
        </Row>
        <Row label={t("worker.country")}>{place(countries, profile.countryId)}</Row>
        <Row label={t("worker.city")}>{place(cities, profile.cityId)}</Row>
        <Row label={t("worker.serviceAreas")}>
          {profile.serviceAreas.length
            ? profile.serviceAreas.map((c, i) => (
                <span key={c}>
                  {i > 0 && "، "}
                  {place(cities, c)}
                </span>
              ))
            : t("common.none")}
        </Row>
        <Row label={t("worker.bio")}>{localized(profile.bio, locale) || t("common.none")}</Row>
        <Row label={t("worker.experience")}>{formatNumber(profile.yearsOfExperience, locale)}</Row>
        <Row label={t("worker.languages")}>
          <Ltr>{profile.languages.join(", ") || t("common.none")}</Ltr>
        </Row>
        <Row label={t("worker.availability")}>
          {profile.isAvailable ? t("worker.available") : t("worker.unavailable")}
        </Row>
        <Row label={t("worker.financialStatus")}>
          <Ltr>{profile.financialStatus}</Ltr>
        </Row>
        <Row label={t("worker.rating")}>
          {formatNumber(profile.rating, locale)} · {t("worker.completedBookings")}:{" "}
          {formatNumber(profile.completedBookings, locale)}
        </Row>
        <Row label={t("worker.createdAt")}>{formatDateTime(profile.createdAt, locale)}</Row>
        <Row label={t("worker.updatedAt")}>{formatDateTime(profile.updatedAt, locale)}</Row>
        <Row label={t("worker.reviewedAt")}>{formatDateTime(profile.reviewedAt, locale) || t("common.none")}</Row>
        {profile.rejectionReason && (
          <Row label={t("worker.rejectionReason")}>
            <span className="text-danger">{localized(profile.rejectionReason, locale)}</span>
          </Row>
        )}
      </dl>
    </Card>
  );
}
