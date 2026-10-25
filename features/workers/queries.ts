"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type {
  ReviewDocumentDto,
  ReviewWorkerDto,
  Worker360,
  WorkerDetail,
  WorkerProfile,
  WorkerStatus,
} from "@/lib/api/types";
import { dashboardKeys } from "@/features/dashboard/queries";

export const WORKERS_PAGE_SIZE = 20; // backend caps limit at 100

export type WorkerListParams = { status?: WorkerStatus; page: number };

export const workerKeys = {
  all: ["workers"] as const,
  lists: () => [...workerKeys.all, "list"] as const,
  list: (p: WorkerListParams) => [...workerKeys.lists(), p] as const,
  detail: (id: string) => [...workerKeys.all, "detail", id] as const,
  view360: (id: string) => [...workerKeys.all, "360", id] as const,
};

export function useWorkerList(params: WorkerListParams) {
  return useQuery({
    queryKey: workerKeys.list(params),
    queryFn: ({ signal }) =>
      api.getPage<WorkerProfile>("/admin/workers", {
        query: { status: params.status, page: params.page, limit: WORKERS_PAGE_SIZE },
        signal,
      }),
    placeholderData: keepPreviousData,
  });
}

/** Profile + document METADATA. Never fetches a document's file or URL. */
export function useWorkerDetail(id: string) {
  return useQuery({
    queryKey: workerKeys.detail(id),
    queryFn: ({ signal }) => api.get<WorkerDetail>(`/admin/workers/${id}`, { signal }),
  });
}

/** Services and recent bookings for the detail page. */
export function useWorker360(id: string) {
  return useQuery({
    queryKey: workerKeys.view360(id),
    queryFn: ({ signal }) => api.get<Worker360>(`/admin/console/workers/${id}/360`, { signal }),
  });
}

/** Everything a review can change: this worker, every list page, the dashboard counts. */
function useInvalidateAfterReview(workerId: string) {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: workerKeys.detail(workerId) }),
      qc.invalidateQueries({ queryKey: workerKeys.view360(workerId) }),
      qc.invalidateQueries({ queryKey: workerKeys.lists() }),
      qc.invalidateQueries({ queryKey: dashboardKeys.all }),
    ]);
}

export function useReviewDocument(workerId: string) {
  const invalidate = useInvalidateAfterReview(workerId);
  return useMutation({
    mutationFn: ({ docId, ...dto }: ReviewDocumentDto & { docId: string }) =>
      api.post<unknown>(`/admin/workers/${workerId}/documents/${docId}/review`, dto),
    onSettled: invalidate,
  });
}

export function useReviewWorker(workerId: string) {
  const invalidate = useInvalidateAfterReview(workerId);
  return useMutation({
    mutationFn: (dto: ReviewWorkerDto) => api.post<unknown>(`/admin/workers/${workerId}/review`, dto),
    onSettled: invalidate,
  });
}
