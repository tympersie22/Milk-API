import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="dashboard-shell">
      <div className="sidebar" />
      <div className="dashboard-main">
        <div className="topbar" />
        <main className="dashboard-content">
          <div className="mb-6">
            <Skeleton width="260px" height="32px" className="mb-2" />
            <Skeleton width="420px" height="14px" />
          </div>

          <div className="stat-grid mb-6">
            {Array.from({ length: 4 }).map((_, idx) => (
              <Card padding="md" key={idx}>
                <Skeleton width="40%" height="12px" className="mb-3" />
                <Skeleton width="55%" height="30px" />
              </Card>
            ))}
          </div>

          <Card padding="md" className="mb-6">
            <Skeleton width="180px" height="20px" className="mb-4" />
            <Skeleton width="100%" height="120px" />
          </Card>
        </main>
      </div>
    </div>
  );
}
