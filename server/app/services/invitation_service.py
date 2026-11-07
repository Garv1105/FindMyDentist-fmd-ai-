import logging
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.core.security import hash_token, new_invite_token
from app.models.clinic import ClinicMembership, Invitation
from app.models.user import User
from app.repositories.clinic_repository import ClinicRepository
from app.repositories.invitation_repository import InvitationRepository
from app.repositories.user_repository import UserRepository
from app.schemas.clinic import InviteCreate, InviteCreated, InvitePreview
from app.services.email import get_mailer

INVALID_INVITE = "This invite link is invalid or has expired. Ask the clinic for a new one."
EMAIL_TAKEN = "That email already belongs to another FMD account. Sign in with it to accept."

logger = logging.getLogger("app.invitations")


def mask_email(email: str) -> str:
    local, _, domain = email.partition("@")
    return f"{local[:1]}{'*' * max(3, len(local) - 1)}@{domain}"


class InvitationService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.invitations = InvitationRepository(db)
        self.clinics = ClinicRepository(db)
        self.users = UserRepository(db)

    async def create(self, inviter: ClinicMembership, data: InviteCreate) -> InviteCreated:
        existing_user = await self.users.get_by_verified_email(data.email)
        if existing_user:
            member = await self.clinics.get_membership(inviter.clinic_id, existing_user.id)
            if member and member.status == "active":
                raise ConflictError("This person is already a member of the clinic")
        await self.invitations.revoke_pending_for_email(inviter.clinic_id, data.email)
        token, token_hash = new_invite_token()
        settings = get_settings()
        invitation = Invitation(
            clinic_id=inviter.clinic_id,
            invited_by=inviter.user_id,
            email=data.email,
            role=data.role,
            token_hash=token_hash,
            expires_at=datetime.now(UTC) + timedelta(days=settings.invite_ttl_days),
        )
        try:
            await self.invitations.add(invitation)
        except IntegrityError:
            raise ConflictError("An invite for this email was just created") from None
        await self.db.refresh(invitation)
        url = f"{settings.clinic_os_url}/invite/{token}"
        clinic = await self.clinics.get(inviter.clinic_id)
        await self._send_email(data.email, clinic.name, clinic.city, data.role, url, settings)
        return InviteCreated(
            id=invitation.id,
            email=invitation.email,
            role=invitation.role,
            expires_at=invitation.expires_at,
            created_at=invitation.created_at,
            url=url,
        )

    @staticmethod
    async def _send_email(
        to: str, clinic_name: str, clinic_city: str, role: str, url: str, settings
    ) -> None:
        subject = f"You're invited to join {clinic_name} on FMD Clinic OS"
        body = (
            f"Hi,\n\n{clinic_name} ({clinic_city}) has invited you to join their clinic on "
            f"FMD Clinic OS as {role}.\n\nAccept your invite:\n{url}\n\n"
            f"This link expires in {settings.invite_ttl_days} days. "
            "If you weren't expecting this, you can ignore this email."
        )
        try:
            await get_mailer().send(to, subject, body)
        except Exception:
            logger.exception("Invite email to %s failed", to)

    async def list_pending(self, clinic_id: uuid.UUID) -> list[Invitation]:
        return await self.invitations.list_pending(clinic_id)

    async def revoke(self, clinic_id: uuid.UUID, invitation_id: uuid.UUID) -> None:
        invitation = await self.invitations.get(clinic_id, invitation_id)
        if invitation is None or invitation.status != "pending":
            raise NotFoundError("Invite not found")
        invitation.status = "revoked"
        await self.db.flush()

    async def _valid(self, token: str, *, lock: bool = False) -> Invitation:
        invitation = await self.invitations.get_by_token_hash(hash_token(token), lock=lock)
        if (
            invitation is None
            or invitation.status != "pending"
            or invitation.expires_at <= datetime.now(UTC)
            or invitation.clinic.status != "active"
        ):
            raise NotFoundError(INVALID_INVITE)
        return invitation

    async def preview(self, token: str) -> InvitePreview:
        invitation = await self._valid(token)
        return InvitePreview(
            clinic_name=invitation.clinic.name,
            clinic_city=invitation.clinic.city,
            role=invitation.role,
            email_hint=mask_email(invitation.email),
            expires_at=invitation.expires_at,
        )

    async def accept(self, token: str, user: User) -> ClinicMembership:
        invitation = await self._valid(token, lock=True)
        await self._bind_email(invitation.email, user)
        membership = await self.clinics.get_membership(invitation.clinic_id, user.id)
        if membership and membership.status == "active":
            raise ConflictError("You are already a member of this clinic")
        if membership:
            membership.role, membership.status = invitation.role, "active"
        else:
            membership = ClinicMembership(
                clinic_id=invitation.clinic_id, user_id=user.id, role=invitation.role
            )
            self.db.add(membership)
        invitation.status, invitation.accepted_by = "accepted", user.id
        try:
            await self.db.flush()
        except IntegrityError:
            raise ConflictError(EMAIL_TAKEN) from None
        return membership

    async def _bind_email(self, email: str, user: User) -> None:
        if user.email_verified:
            if user.email != email:
                raise ForbiddenError(
                    f"This invite was sent to {mask_email(email)}. "
                    "Sign in with that email to accept it."
                )
            return
        other = await self.users.get_by_verified_email(email)
        if other and other.id != user.id:
            raise ForbiddenError(EMAIL_TAKEN)
        user.email = email
        user.email_verified_at = datetime.now(UTC)
