from app.core import cache
from app.core.exceptions import TooManyRequestsError


async def hit(key: str, limit: int, window_seconds: int, message: str) -> None:
    key = f"rl:{key}"
    async with cache.redis.pipeline(transaction=True) as pipe:
        count, _ = await pipe.incr(key).expire(key, window_seconds, nx=True).execute()
    if count > limit:
        raise TooManyRequestsError(message)