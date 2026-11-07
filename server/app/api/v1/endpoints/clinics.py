import uuid

from fastapi import APIRouter, status

from app.api.deps import ClinicMember, ClinicOwner, CurrentUser, DbSession
from app.models.clinic import Clinic, ClinicMembership, Invitation
from app.schemas.clinic import (
    ClinicCreate,
    ClinicRead,
    ClinicUpdate,
    InviteCreate,
    InviteCreated,
    InviteRead,
    MemberRead,
    MemberUpdate,
    MyMembership,
)
from app.services.clinic_service import ClinicService
from app.services.invitation_service import InvitationService

router = APIRouter(prefix="/clinics", tags=["clinics"])


@router.post("", response_model=ClinicRead, status_code=status.HTTP_201_CREATED)
async def register_clinic(data: ClinicCreate, user: CurrentUser, db: DbSession) -> Clinic:
    return await ClinicService(db).register_clinic(user, data)


@router.get("/{clinic_id}", response_model=MyMembership)
async def get_clinic(membership: ClinicMember, db: DbSession) -> MyMembership:
    clinic = await ClinicService(db).get(membership.clinic_id)
    return MyMembership(clinic=ClinicRead.model_validate(clinic), role=membership.role)


@router.patch("/{clinic_id}", response_model=ClinicRead)
async def update_clinic(data: ClinicUpdate, owner: ClinicOwner, db: DbSession) -> Clinic:
    return await ClinicService(db).update(owner.clinic_id, data)


@router.get("/{clinic_id}/members", response_model=list[MemberRead])
async def list_members(membership: ClinicMember, db: DbSession) -> list[ClinicMembership]:
    return await ClinicService(db).members(membership.clinic_id)


@router.patch("/{clinic_id}/members/{user_id}", response_model=MemberRead)
async def update_member(
    user_id: uuid.UUID, data: MemberUpdate, owner: ClinicOwner, db: DbSession
) -> ClinicMembership:
    return await ClinicService(db).update_member(owner.clinic_id, user_id, data)


@router.post(
    "/{clinic_id}/invitations", response_model=InviteCreated, status_code=status.HTTP_201_CREATED
)
async def create_invitation(data: InviteCreate, owner: ClinicOwner, db: DbSession) -> InviteCreated:
    return await InvitationService(db).create(owner, data)


@router.get("/{clinic_id}/invitations", response_model=list[InviteRead])
async def list_invitations(owner: ClinicOwner, db: DbSession) -> list[Invitation]:
    return await InvitationService(db).list_pending(owner.clinic_id)


@router.delete("/{clinic_id}/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_invitation(invitation_id: uuid.UUID, owner: ClinicOwner, db: DbSession) -> None:
    await InvitationService(db).revoke(owner.clinic_id, invitation_id)
