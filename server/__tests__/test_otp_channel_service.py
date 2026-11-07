import pytest

from app.core.exceptions import UnauthorizedError
from app.services.messaging.otp_channel import Destination
from app.services.otp_service import OtpService


def _fake_channel(returns: str = "email"):
    class FakeChannel:
        async def deliver(self, address, code, purpose):
            return returns

    return FakeChannel()


async def test_send_and_verify_over_email(fake_redis, monkeypatch):
    delivered = {}

    class FakeChannel:
        async def deliver(self, address, code, purpose):
            delivered.update(address=address, code=code, purpose=purpose)
            return "email"

    monkeypatch.setattr(
        "app.services.otp_service.get_otp_channel", lambda kind: FakeChannel()
    )
    svc = OtpService()
    dest = Destination.email("user@example.com")
    assert await svc.send(dest, "login") == "email"
    assert delivered["address"] == "user@example.com"
    await svc.verify(dest, "login", delivered["code"])
    with pytest.raises(UnauthorizedError):
        await svc.verify(dest, "login", delivered["code"])


async def test_email_destination_skips_country_allowlist(fake_redis, monkeypatch):
    monkeypatch.setattr(
        "app.services.otp_service.get_otp_channel", lambda kind: _fake_channel()
    )
    svc = OtpService()
    await svc.send(Destination.email("user@example.com"), "login")


async def test_proof_is_bound_to_destination(fake_redis):
    svc = OtpService()
    sms = Destination.sms("+919000000001")
    token = await svc.issue_proof(sms, "reset_password")
    with pytest.raises(UnauthorizedError):
        await svc.use_proof(Destination.email("user@example.com"), "reset_password", token)
    token2 = await svc.issue_proof(sms, "reset_password")
    await svc.use_proof(sms, "reset_password", token2)
