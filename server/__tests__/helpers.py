from contextlib import asynccontextmanager
from itertools import count

from httpx import ASGITransport, AsyncClient

from app.main import app

OTP = "123456"
_numbers = count(9000000001)
_emails = count(1)


def new_phone() -> str:
    return f"+91{next(_numbers)}"


def new_email() -> str:
    return f"user{next(_emails)}@example.com"


async def verify_email(c: AsyncClient, email: str) -> None:
    assert (await c.post("/api/v1/me/email", json={"email": email})).status_code == 204
    assert (await c.post("/api/v1/me/email/verify", json={"code": OTP})).status_code == 204


def anon() -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


async def register(c: AsyncClient, phone: str, *, otp: str = OTP, name: str = "Test User"):
    r = await c.post("/api/v1/auth/otp", json={"phone": phone})
    assert r.status_code == 204, r.text
    return await c.post("/api/v1/auth/register", json={
        "full_name": name, "phone": phone, "password": "Correct-horse1",
        "otp": otp, "accept_terms": True, "age_confirmed": True,
    })


@asynccontextmanager
async def signed_in(
    phone: str | None = None, *, dentist: bool = False, registration_no=None, email: bool = False
):
    phone = phone or new_phone()
    async with anon() as c:
        r = await register(c, phone)
        assert r.status_code == 201, r.text
        c.phone = phone
        c.email = None
        if email:
            c.email = new_email()
            await verify_email(c, c.email)
        if dentist:
            r = await c.put("/api/v1/me/dentist-profile", json={
                "council": "Madhya Pradesh State Dental Council",
                "registration_no": registration_no or f"A-{phone}",
            })
            assert r.status_code == 200, r.text
        yield c
