import hashlib
import logging

import httpx

from app.core.config import get_settings
from app.core.exceptions import AppError

logger = logging.getLogger("app.password_policy")
PWNED_RANGE_URL = "https://api.pwnedpasswords.com/range/"


class BreachedPasswordError(AppError):
    status_code = 422
    code = "breached_password"


async def ensure_not_breached(password: str) -> None:
    if not get_settings().breached_password_check:
        return
    digest = hashlib.sha1(password.encode(), usedforsecurity=False).hexdigest().upper()
    prefix, suffix = digest[:5], digest[5:]
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(PWNED_RANGE_URL + prefix, headers={"Add-Padding": "true"})
            response.raise_for_status()
    except httpx.HTTPError:
        logger.warning("Breached-password check unavailable; allowing password")
        return
    for line in response.text.splitlines():
        found, _, count = line.partition(":")
        if found == suffix and int(count or 0) > 0:
            raise BreachedPasswordError(
                "This password has appeared in a data breach. Please choose a different one."
            )
