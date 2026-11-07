from fastapi import APIRouter
from sqlalchemy import text

from app.api.deps import DbSession

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(db: DbSession) -> dict[str, str]:
    await db.execute(text("select 1"))
    return {"status": "ok"}
