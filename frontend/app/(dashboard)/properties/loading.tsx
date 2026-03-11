import { Card } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";

export default function PropertiesLoading() {
  return (
    <>
      <div className="mb-6">
        <Skeleton width="160px" height="30px" className="mb-2" />
        <Skeleton width="360px" height="14px" />
      </div>

      <Card padding="md" className="mb-6">
        <Skeleton width="180px" height="20px" className="mb-4" />
        <div className="form-row mb-4">
          <Skeleton width="100%" height="58px" />
          <Skeleton width="100%" height="58px" />
        </div>
        <div className="flex gap-2">
          <Skeleton width="110px" height="38px" />
          <Skeleton width="110px" height="38px" />
        </div>
      </Card>

      <Card padding="md">
        <Skeleton width="100%" height="300px" />
      </Card>
    </>
  );
}
