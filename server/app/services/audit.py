import uuid
from typing import Any

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.security import AuthEvent


def client_ip(request: Request | None) -> str | None:
    return request.client.host if request and request.client else None


def user_agent(request: Request | None) -> str | None:
    return request.headers.get("user-agent", "")[:512] or None if request else None


async def record(
    db: AsyncSession,
    event: str,
    result: str,
    *,
    request: Request | None = None,
    user_id: uuid.UUID | None = None,
    **meta: Any,
) -> None:
    db.add(
        AuthEvent(
            user_id=user_id,
            event=event,
            result=result,
            ip=client_ip(request),
            user_agent=user_agent(request),
            meta=meta,
        )
    )
    await db.flush()
