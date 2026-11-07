import uuid

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.clinic import Invitation


class InvitationRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(self, clinic_id: uuid.UUID, invitation_id: uuid.UUID) -> Invitation | None:
        return await self.db.scalar(
            select(Invitation).where(
                Invitation.clinic_id == clinic_id, Invitation.id == invitation_id
            )
        )

    async def get_by_token_hash(self, token_hash: str, *, lock: bool = False) -> Invitation | None:
        query = (
            select(Invitation)
            .where(Invitation.token_hash == token_hash)
            .options(selectinload(Invitation.clinic))
        )
        if lock:
            query = query.with_for_update(of=Invitation)
        return await self.db.scalar(query)

    async def list_pending(self, clinic_id: uuid.UUID) -> list[Invitation]:
        result = await self.db.scalars(
            select(Invitation)
            .where(
                Invitation.clinic_id == clinic_id,
                Invitation.status == "pending",
                Invitation.expires_at > func.now(),
            )
            .order_by(Invitation.created_at.desc())
        )
        return list(result)

    async def revoke_pending_for_email(self, clinic_id: uuid.UUID, email: str) -> None:
        await self.db.execute(
            update(Invitation)
            .where(
                Invitation.clinic_id == clinic_id,
                Invitation.email == email,
                Invitation.status == "pending",
            )
            .values(status="revoked")
        )

    async def add(self, invitation: Invitation) -> Invitation:
        self.db.add(invitation)
        await self.db.flush()
        return invitation
