import { Card } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";

export default function ReportsLoading() {
  return (
    <>
      <div className="mb-6">
        <Skeleton width="120px" height="30px" className="mb-2" />
        <Skeleton width="340px" height="14px" />
      </div>

      <Card padding="md" className="mb-6">
        <Skeleton width="120px" height="20px" className="mb-4" />
        <div className="form-row">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} width="100%" height="58px" />
          ))}
        </div>
      </Card>

      <Card padding="md">
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, idx) => (
            <Skeleton key={idx} width="100%" height="52px" />
          ))}
        </div>
      </Card>
    </>
  );
}
