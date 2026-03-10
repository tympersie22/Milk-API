from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta
from threading import Lock


class InMemoryRateLimiter:
    def __init__(self) -> None:
        self._buckets: dict[str, deque[datetime]] = defaultdict(deque)
        self._lock = Lock()

    def allow(self, key: str, limit: int) -> bool:
        now = datetime.now(UTC)
        window_start = now - timedelta(minutes=1)
        with self._lock:
            bucket = self._buckets[key]

            while bucket and bucket[0] < window_start:
                bucket.popleft()

            if len(bucket) >= limit:
                return False

            bucket.append(now)
        return True

    def clear(self) -> None:
        with self._lock:
            self._buckets.clear()


rate_limiter = InMemoryRateLimiter()
