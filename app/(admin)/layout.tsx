import { AdminGate } from "@/components/shell/admin-gate";
import { AppShell } from "@/components/shell/app-shell";

// Every page in this route group requires an authenticated ADMIN.
export default function AdminLayout({ children }: LayoutProps<"/">) {
  return (
    <AdminGate>
      <AppShell>{children}</AppShell>
    </AdminGate>
  );
}
