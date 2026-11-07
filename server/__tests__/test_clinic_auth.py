from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy import text

from app.db.session import engine

from .helpers import OTP, anon, new_email, new_phone, register, signed_in


async def open_clinic(c: AsyncClient) -> str:
    r = await c.post("/api/v1/clinics", json={
        "name": "Lumen Dental", "city": "Indore", "phone": "+91 731 400 1234",
    })
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def invite(c: AsyncClient, clinic_id: str, email: str, role: str) -> str:
    r = await c.post(
        f"/api/v1/clinics/{clinic_id}/invitations", json={"email": email, "role": role}
    )
    assert r.status_code == 201, r.text
    url = r.json()["url"]
    assert url.startswith("http://localhost:3001/invite/")
    return url.rsplit("/", 1)[1]


async def test_signup_with_otp_then_login_by_mobile():
    async with anon() as c:
        r = await register(c, "98765 43210", name="Asha Rao")
        assert r.status_code == 201, r.text
        me = (await c.get("/api/v1/auth/me")).json()
        assert me["phone"] == "+919876543210" and me["email"] is None
        assert me["dentist_profile"] is None and me["workspaces"] == []
    async with anon() as c:
        r = await c.post("/api/v1/auth/login/password",
                         json={"login": "+91 98765-43210", "password": "Correct-horse1"})
        assert r.status_code == 200
        r = await c.post("/api/v1/auth/login/password",
                         json={"login": "9876543210", "password": "wrong-password"})
        assert r.status_code == 401


async def test_signup_rejects_wrong_otp_missing_terms_and_bad_phone():
    phone = new_phone()
    async with anon() as c:
        assert (await register(c, phone, otp="000000")).status_code == 401
        r = await c.post("/api/v1/auth/register", json={
            "full_name": "X", "phone": phone, "password": "Correct-horse1", "otp": OTP,
            "age_confirmed": True,
        })
        assert r.status_code == 422
        r = await c.post("/api/v1/auth/otp", json={"phone": "12345"})
        assert r.status_code == 400


async def test_otp_is_locked_after_too_many_wrong_codes():
    phone = new_phone()
    async with anon() as c:
        await c.post("/api/v1/auth/otp", json={"phone": phone})
        body = {"full_name": "X", "phone": phone, "password": "Correct-horse1",
                "accept_terms": True, "age_confirmed": True}
        for _ in range(5):
            r = await c.post("/api/v1/auth/register", json={**body, "otp": "000000"})
            assert r.status_code == 401
        r = await c.post("/api/v1/auth/register", json={**body, "otp": OTP})
        assert r.status_code == 401


async def test_otp_resend_is_rate_limited_and_taken_numbers_are_refused():
    async with signed_in() as user, anon() as c:
        assert (await c.post("/api/v1/auth/otp", json={"phone": user.phone})).status_code == 409
        phone = new_phone()
        assert (await c.post("/api/v1/auth/otp", json={"phone": phone})).status_code == 204
        assert (await c.post("/api/v1/auth/otp", json={"phone": phone})).status_code == 429


async def test_registering_a_clinic_requires_a_verified_email():
    async with signed_in() as c:
        r = await c.post("/api/v1/clinics", json={
            "name": "Lumen Dental", "city": "Indore", "phone": "+91 731 400 1234",
        })
        assert r.status_code == 403, r.text


async def test_anyone_can_register_a_clinic_and_becomes_owner():
    async with signed_in(email=True) as c:
        clinic_id = await open_clinic(c)
        me = (await c.get("/api/v1/auth/me")).json()
        assert me["workspaces"] == [
            {"clinic_id": clinic_id, "clinic_name": "Lumen Dental", "role": "owner"}
        ]


async def test_dentist_profile_and_unique_registration():
    async with signed_in(dentist=True, registration_no="A-1") as c:
        me = (await c.get("/api/v1/auth/me")).json()
        assert me["dentist_profile"]["verification_status"] == "unverified"
    async with signed_in() as c:
        r = await c.put("/api/v1/me/dentist-profile", json={
            "council": "Madhya Pradesh State Dental Council", "registration_no": "A-1",
        })
        assert r.status_code == 409


async def test_gstin_is_unique():
    async with signed_in(email=True) as a, signed_in(email=True) as b:
        body = {"name": "X", "city": "Y", "phone": "9876543210", "gstin": "23aaaaa0000a1z5"}
        r = await a.post("/api/v1/clinics", json=body)
        assert r.status_code == 201 and r.json()["gstin"] == "23AAAAA0000A1Z5"
        assert (await b.post("/api/v1/clinics", json=body)).status_code == 409


async def test_invite_by_email_accept_binds_email_and_role_checks():
    async with signed_in(dentist=True, email=True) as owner, signed_in() as rec, \
            signed_in(email=True) as other:
        clinic_id = await open_clinic(owner)
        invitee = new_email()
        token = await invite(owner, clinic_id, invitee, "receptionist")

        preview = (await rec.get(f"/api/v1/invitations/{token}")).json()
        assert preview["clinic_name"] == "Lumen Dental" and preview["role"] == "receptionist"
        assert preview["email_hint"].endswith("@example.com") and "*" in preview["email_hint"]

        assert (await other.post(f"/api/v1/invitations/{token}/accept")).status_code == 403
        r = await rec.post(f"/api/v1/invitations/{token}/accept")
        assert r.json() == {"clinic_id": clinic_id, "role": "receptionist"}
        assert (await rec.get("/api/v1/auth/me")).json()["email"] == invitee
        assert (await rec.post(f"/api/v1/invitations/{token}/accept")).status_code == 404

        assert (await rec.get(f"/api/v1/clinics/{clinic_id}")).json()["role"] == "receptionist"
        r = await rec.post(f"/api/v1/clinics/{clinic_id}/invitations",
                           json={"email": new_email(), "role": "dentist"})
        assert r.status_code == 403
        assert (await other.get(f"/api/v1/clinics/{clinic_id}")).status_code == 404

        members = (await owner.get(f"/api/v1/clinics/{clinic_id}/members")).json()
        assert {m["user"]["phone"]: m["role"] for m in members} == {
            owner.phone: "owner", rec.phone: "receptionist",
        }


async def test_finance_and_assistant_roles_can_be_invited_and_changed():
    async with signed_in(email=True) as owner, signed_in() as fin:
        clinic_id = await open_clinic(owner)
        token = await invite(owner, clinic_id, new_email(), "finance")
        assert (await fin.post(f"/api/v1/invitations/{token}/accept")).json()["role"] == "finance"
        me = (await fin.get("/api/v1/auth/me")).json()
        assert me["workspaces"] == [
            {"clinic_id": clinic_id, "clinic_name": "Lumen Dental", "role": "finance"}
        ]

        r = await owner.patch(
            f"/api/v1/clinics/{clinic_id}/members/{me['id']}", json={"role": "assistant"}
        )
        assert r.status_code == 200 and r.json()["role"] == "assistant"
        r = await owner.post(f"/api/v1/clinics/{clinic_id}/invitations",
                             json={"email": new_email(), "role": "janitor"})
        assert r.status_code == 422


async def test_revoked_and_expired_invites_are_rejected():
    async with signed_in(email=True) as owner, signed_in() as rec:
        clinic_id = await open_clinic(owner)
        invitee = new_email()
        first = await invite(owner, clinic_id, invitee, "receptionist")
        second = await invite(owner, clinic_id, invitee, "dentist")
        assert (await rec.get(f"/api/v1/invitations/{first}")).status_code == 404

        async with engine.begin() as conn:
            await conn.execute(
                text("update invitations set expires_at = :t where status = 'pending'"),
                {"t": datetime.now(UTC) - timedelta(minutes=1)},
            )
        assert (await rec.post(f"/api/v1/invitations/{second}/accept")).status_code == 404


async def test_clinic_keeps_at_least_one_owner():
    async with signed_in(email=True) as owner:
        clinic_id = await open_clinic(owner)
        me = (await owner.get("/api/v1/auth/me")).json()
        url = f"/api/v1/clinics/{clinic_id}/members/{me['id']}"
        assert (await owner.patch(url, json={"role": "dentist"})).status_code == 409
        assert (await owner.patch(url, json={"status": "deactivated"})).status_code == 409
        assert (await owner.get(f"/api/v1/clinics/{clinic_id}")).json()["role"] == "owner"
