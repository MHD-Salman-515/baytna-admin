"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import type { Dashboard } from "@/lib/api/types";

export const dashboardKeys = { all: ["dashboard"] as const };

export function useDashboard() {
  return useQuery({
    queryKey: dashboardKeys.all,
    queryFn: ({ signal }) => api.get<Dashboard>("/admin/console/dashboard", { signal }),
    refetchInterval: 60_000,
  });
}
