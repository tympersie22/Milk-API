import { Card } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <>
      <div className="mb-6">
        <Skeleton width="130px" height="30px" className="mb-2" />
        <Skeleton width="340px" height="14px" />
      </div>

      <Card padding="md" className="mb-6">
        <Skeleton width="90px" height="20px" className="mb-4" />
        <div className="form-row">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Skeleton key={idx} width="100%" height="52px" />
          ))}
        </div>
      </Card>

      <Card padding="md" className="mb-6">
        <Skeleton width="120px" height="20px" className="mb-4" />
        <Skeleton width="100%" height="52px" />
      </Card>

      <Card padding="md">
        <Skeleton width="140px" height="20px" className="mb-4" />
        <Skeleton width="100%" height="62px" />
      </Card>
    </>
  );
}
