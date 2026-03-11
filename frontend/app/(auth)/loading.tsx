import { Card } from "../../components/ui/card";
import { Skeleton } from "../../components/ui/skeleton";

export default function AuthLoading() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <Skeleton width="40px" height="40px" style={{ borderRadius: "var(--radius-lg)" }} />
          <Skeleton width="84px" height="22px" />
        </div>

        <Card padding="lg">
          <Skeleton width="140px" height="24px" className="mb-2" />
          <Skeleton width="80%" height="14px" className="mb-6" />

          <div className="flex flex-col gap-4">
            <Skeleton width="100%" height="58px" />
            <Skeleton width="100%" height="58px" />
            <Skeleton width="100%" height="40px" className="mt-2" />
          </div>
        </Card>
      </div>
    </div>
  );
}
