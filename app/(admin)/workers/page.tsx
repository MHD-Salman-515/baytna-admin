import { Suspense } from "react";
import { TableSkeleton } from "@/components/ui/skeleton";
import { WorkerQueue } from "./worker-queue";

export default function WorkersPage() {
  // useSearchParams() inside WorkerQueue needs a Suspense boundary.
  return (
    <Suspense fallback={<TableSkeleton />}>
      <WorkerQueue />
    </Suspense>
  );
}
