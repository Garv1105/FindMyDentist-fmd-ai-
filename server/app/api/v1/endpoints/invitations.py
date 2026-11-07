from fastapi import APIRouter

from app.api.deps import CurrentUser, DbSession
from app.schemas.clinic import InviteAccepted, InvitePreview
from app.services.invitation_service import InvitationService

router = APIRouter(prefix="/invitations", tags=["invitations"])


@router.get("/{token}", response_model=InvitePreview)
async def preview_invitation(token: str, db: DbSession) -> InvitePreview:
    return await InvitationService(db).preview(token)


@router.post("/{token}/accept", response_model=InviteAccepted)
async def accept_invitation(token: str, user: CurrentUser, db: DbSession) -> InviteAccepted:
    membership = await InvitationService(db).accept(token, user)
    return InviteAccepted(clinic_id=membership.clinic_id, role=membership.role)
