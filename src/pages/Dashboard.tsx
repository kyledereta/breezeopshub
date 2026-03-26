import { AppLayout } from "@/components/AppLayout";
import { DashboardOverview } from "@/components/DashboardOverview";

export default function DashboardPage() {
  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-3rem)]">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border shrink-0">
          <h1 className="text-xl sm:text-3xl font-display text-foreground tracking-wide">Dashboard</h1>
        </div>
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <DashboardOverview />
        </div>
      </div>
    </AppLayout>
  );
}
