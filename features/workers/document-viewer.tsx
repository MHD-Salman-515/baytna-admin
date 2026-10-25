"use client";

// Viewer for worker identity documents (national ID, criminal record).
//
// Rules this file enforces:
// - The file is fetched ONLY by `open()`, which is called from the admin's
//   click. Never from an effect, never prefetched: every fetch writes an audit
//   entry on the backend, and an effect could run twice (StrictMode) or early.
// - Bytes live in React state only, rendered from memory, and are dropped on
//   close. No URL is ever exposed: no link, no new tab, no download.
// - Nothing about the document is logged.

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { WorkerDocument } from "@/lib/api/types";
import { useT } from "@/lib/i18n";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";

type ViewerState =
  | { status: "loading"; doc: WorkerDocument }
  | { status: "ready"; doc: WorkerDocument; blob: Blob }
  | { status: "error"; doc: WorkerDocument; error: unknown };

export function useDocumentViewer(workerId: string) {
  const [state, setState] = useState<ViewerState | null>(null);
  const controller = useRef<AbortController | null>(null);

  /** Call from a click handler only. Each call is one audited access. */
  const open = useCallback(
    (doc: WorkerDocument) => {
      controller.current?.abort();
      const ac = new AbortController();
      controller.current = ac;
      setState({ status: "loading", doc });
      api
        .postForBlob("/api/documents/view", { workerId, docId: doc.id, mimeType: doc.mimeType }, { signal: ac.signal })
        .then((blob) => {
          if (!ac.signal.aborted) setState({ status: "ready", doc, blob });
        })
        .catch((error: unknown) => {
          if (!ac.signal.aborted) setState({ status: "error", doc, error });
        });
    },
    [workerId],
  );

  const close = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setState(null);
  }, []);

  // Leaving the page discards whatever is open.
  useEffect(() => () => controller.current?.abort(), []);

  return { state, open, close };
}

export function DocumentViewerModal({
  state,
  title,
  onClose,
  onRetry,
}: {
  state: ViewerState | null;
  title: string;
  onClose: () => void;
  onRetry: () => void;
}) {
  const t = useT();
  return (
    <Modal open={state !== null} onClose={onClose} title={title} size="xl">
      <p className="no-print mb-3 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning">{t("viewer.notice")}</p>
      {state?.status === "loading" && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
          <Spinner />
          {t("viewer.loading")}
        </div>
      )}
      {state?.status === "error" &&
        (isApiError(state.error) && state.error.code === "InsecureDocumentUrl" ? (
          // Retrying would only write another audit entry and fail the same way.
          <p role="alert" className="px-4 py-10 text-center text-sm text-danger">
            {t("viewer.insecure")}
          </p>
        ) : (
          <ErrorState error={state.error} onRetry={onRetry} />
        ))}
      {state?.status === "ready" && (
        <div
          className="no-save no-print flex justify-center bg-surface-2 p-2"
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
        >
          {state.blob.type === "application/pdf" ? (
            <PdfCanvas blob={state.blob} />
          ) : state.blob.type.startsWith("image/") ? (
            <ImageFromMemory blob={state.blob} alt={title} />
          ) : (
            <p className="py-10 text-sm text-muted">{t("viewer.unsupported")}</p>
          )}
        </div>
      )}
    </Modal>
  );
}

function ImageFromMemory({ blob, alt }: { blob: Blob; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    // blob: URLs are in-memory and page-scoped; revoked as soon as the viewer closes.
    const url = URL.createObjectURL(blob);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- object URL lifecycle is tied to this effect
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  if (!src) return null;
  // eslint-disable-next-line @next/next/no-img-element -- must not go through the image optimizer/cache
  return <img src={src} alt={alt} draggable={false} className="max-h-[70vh] max-w-full object-contain" />;
}

/** Renders every page to <canvas> with pdf.js: no native viewer, so no download/print toolbar. */
function PdfCanvas({ blob }: { blob: Blob }) {
  const t = useT();
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let destroy: (() => void) | undefined;
    const host = container.current;

    (async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
      destroy = () => void task.destroy();
      const pdf = await task.promise;
      for (let n = 1; n <= pdf.numPages && !cancelled; n++) {
        const page = await pdf.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(2, 900 / base.width) * (window.devicePixelRatio || 1);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / (window.devicePixelRatio || 1)}px`;
        canvas.style.maxWidth = "100%";
        canvas.className = "mb-2 bg-white shadow";
        if (cancelled || !host) break;
        host.appendChild(canvas);
        await page.render({ canvas, viewport }).promise;
      }
    })().catch(() => {
      if (!cancelled) setFailed(true);
    });

    return () => {
      cancelled = true;
      destroy?.();
      host?.replaceChildren();
    };
  }, [blob]);

  if (failed) return <p className="py-10 text-sm text-danger">{t("viewer.failed")}</p>;
  return <div ref={container} className="flex flex-col items-center" />;
}
