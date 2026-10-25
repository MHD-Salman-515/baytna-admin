import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkerDetailView } from "./worker-detail";

export default function WorkerPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <WorkerDetailView />
    </Suspense>
  );
}
