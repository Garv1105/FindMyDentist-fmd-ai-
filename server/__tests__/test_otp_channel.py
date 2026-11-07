from app.services.messaging.otp_channel import (
    OTP_EMAIL_SUBJECT,
    Destination,
    EmailOtpChannel,
    SmsOtpChannel,
    get_otp_channel,
)


def test_destination_constructors():
    assert Destination.sms("+919000000001") == Destination("sms", "+919000000001")
    assert Destination.email("a@b.com") == Destination("email", "a@b.com")


def test_registry_selects_by_kind():
    assert isinstance(get_otp_channel("sms"), SmsOtpChannel)
    assert isinstance(get_otp_channel("email"), EmailOtpChannel)


async def test_sms_channel_delegates_to_sender(monkeypatch):
    sent = {}

    class FakeSender:
        async def send_otp(self, phone, code, purpose):
            sent.update(phone=phone, code=code, purpose=purpose)
            return "sms"

    monkeypatch.setattr(
        "app.services.messaging.otp_channel.get_sender", lambda: FakeSender()
    )
    assert await SmsOtpChannel().deliver("+919000000001", "123456", "signup") == "sms"
    assert sent == {"phone": "+919000000001", "code": "123456", "purpose": "signup"}


async def test_email_channel_sends_code_and_returns_email(monkeypatch):
    sent = {}

    class FakeMailer:
        async def send(self, to, subject, text):
            sent.update(to=to, subject=subject, text=text)

    monkeypatch.setattr(
        "app.services.messaging.otp_channel.get_mailer", lambda: FakeMailer()
    )
    assert await EmailOtpChannel().deliver("a@b.com", "654321", "login") == "email"
    assert sent["to"] == "a@b.com" and sent["subject"] == OTP_EMAIL_SUBJECT
    assert "654321" in sent["text"]
