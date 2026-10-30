import time
from collections import defaultdict, deque


class RateLimiter:
    """In-memory sliding-window limiter, per client id.

    Keeps one shared Gemini key from being used up by a single install. State
    resets when the server restarts, which is fine for a single-process demo.
    """

    def __init__(self, per_minute: int, per_day: int, clock=time.monotonic) -> None:
        self._per_minute = per_minute
        self._per_day = per_day
        self._clock = clock
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, client_id: str) -> bool:
        now = self._clock()
        hits = self._hits[client_id]
        while hits and now - hits[0] > 86_400:
            hits.popleft()
        if len(hits) >= self._per_day:
            return False
        last_minute = sum(1 for t in hits if now - t <= 60)
        if last_minute >= self._per_minute:
            return False
        hits.append(now)
        return True
