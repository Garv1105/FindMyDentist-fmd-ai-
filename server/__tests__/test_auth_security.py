import hashlib

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.core.config import get_settings
from app.db.session import engine
from app.services import password_policy

from .helpers import OTP, anon, new_phone, register, signed_in

PASSWORD = "Correct-horse1"


async def login_password(c, login: str, password: str = PASSWORD):
    return await c.post("/api/v1/auth/login/password", json={"login": login, "password": password})


async def request_otp(c, phone: str, purpose: str):
    return await c.post("/api/v1/auth/otp", json={"phone": phone, "purpose": purpose})


async def test_sessions_are_listed_and_logout_revokes_the_cookie():
    async with signed_in() as web:
        async with anon() as phone_app:
            assert (await login_password(phone_app, web.phone)).status_code == 200
            sessions = (await web.get("/api/v1/me/sessions")).json()
            assert len(sessions) == 2 and sum(s["current"] for s in sessions) == 1

            other = next(s for s in sessions if not s["current"])
            assert (await web.delete(f"/api/v1/me/sessions/{other['id']}")).status_code == 204
            assert (await phone_app.get("/api/v1/auth/me")).status_code == 401

        stolen = dict(web.cookies)
        assert (await web.post("/api/v1/auth/logout")).status_code == 204
        async with anon() as replay:
            replay.cookies.update(stolen)
            assert (await replay.get("/api/v1/auth/me")).status_code == 401


async def test_logout_all_signs_out_every_device():
    async with signed_in() as a:
        async with anon() as b:
            await login_password(b, a.phone)
            assert (await a.post("/api/v1/auth/logout-all")).status_code == 204
            assert (await a.get("/api/v1/auth/me")).status_code == 401
            assert (await b.get("/api/v1/auth/me")).status_code == 401


async def test_otp_login_for_registered_numbers_only():
    async with signed_in() as user, anon() as c:
        assert (await request_otp(c, new_phone(), "login")).status_code == 404
        assert (await request_otp(c, user.phone, "login")).status_code == 204
        r = await c.post("/api/v1/auth/login/otp", json={"phone": user.phone, "code": OTP})
        assert r.status_code == 200
        assert (await c.get("/api/v1/auth/me")).json()["phone"] == user.phone


async def test_password_reset_with_single_use_proof_revokes_sessions():
    async with signed_in() as old_device, anon() as c:
        assert (await request_otp(c, old_device.phone, "reset_password")).status_code == 204
        r = await c.post("/api/v1/auth/otp/verify",
                         json={"phone": old_device.phone, "purpose": "reset_password", "code": OTP})
        proof = r.json()["proof_token"]
        body = {"phone": old_device.phone, "proof_token": proof, "new_password": "New-horse-123"}
        assert (await c.post("/api/v1/auth/password/reset", json=body)).status_code == 204
        assert (await c.post("/api/v1/auth/password/reset", json=body)).status_code == 401

        assert (await old_device.get("/api/v1/auth/me")).status_code == 401
        assert (await login_password(c, old_device.phone)).status_code == 401
        assert (await login_password(c, old_device.phone, "New-horse-123")).status_code == 200


async def test_proof_token_is_bound_to_its_phone():
    async with signed_in() as a, signed_in() as b, anon() as c:
        await request_otp(c, a.phone, "reset_password")
        r = await c.post("/api/v1/auth/otp/verify",
                         json={"phone": a.phone, "purpose": "reset_password", "code": OTP})
        body = {"phone": b.phone, "proof_token": r.json()["proof_token"],
                "new_password": "New-horse-123"}
        assert (await c.post("/api/v1/auth/password/reset", json=body)).status_code == 401


async def test_account_locks_after_repeated_failures_and_otp_login_unlocks(monkeypatch):
    monkeypatch.setattr(get_settings(), "login_max_failures", 3)
    async with signed_in() as user, anon() as c:
        for _ in range(3):
            assert (await login_password(c, user.phone, "wrong-password")).status_code == 401
        r = await login_password(c, user.phone)
        assert r.status_code == 429 and "log in with OTP" in r.json()["error"]["message"]

        await request_otp(c, user.phone, "login")
        assert (await c.post("/api/v1/auth/login/otp",
                             json={"phone": user.phone, "code": OTP})).status_code == 200
        assert (await login_password(c, user.phone)).status_code == 200


async def test_unknown_account_and_wrong_password_look_the_same():
    async with signed_in() as user, anon() as c:
        wrong = await login_password(c, user.phone, "wrong-password")
        unknown = await login_password(c, new_phone())
        assert wrong.status_code == unknown.status_code == 401
        assert wrong.json() == unknown.json()


async def test_cross_site_requests_are_rejected():
    async with signed_in() as c:
        r = await c.post("/api/v1/auth/logout-all", headers={"Origin": "https://evil.example"})
        assert r.status_code == 403
        r = await c.post("/api/v1/auth/logout-all", headers={"Origin": "http://localhost:3000"})
        assert r.status_code == 204


async def test_origin_pattern_allows_previews_only(monkeypatch):
    monkeypatch.setattr(get_settings(), "allowed_origin_regex", r"https://fmd-[a-z0-9-]+\.vercel\.app")
    preview = "https://fmd-abc123-team.vercel.app"
    async with signed_in() as c:
        for origin in (preview + ".evil.example", "https://fmd-abc123-teamXvercel.app"):
            r = await c.post("/api/v1/auth/logout-all", headers={"Origin": origin})
            assert r.status_code == 403
        r = await c.post("/api/v1/auth/logout-all", headers={"Origin": preview})
        assert r.status_code == 204


async def test_otp_only_to_allowed_countries_and_ip_is_rate_limited(monkeypatch):
    async with anon() as c:
        assert (await request_otp(c, "+14155550123", "signup")).status_code == 400
        monkeypatch.setattr(get_settings(), "otp_ip_hourly_limit", 2)
        assert (await request_otp(c, new_phone(), "signup")).status_code == 204
        assert (await request_otp(c, new_phone(), "signup")).status_code == 204
        assert (await request_otp(c, new_phone(), "signup")).status_code == 429


async def test_otp_codes_are_stored_as_keyed_hashes(fake_redis):
    phone = new_phone()
    async with anon() as c:
        await request_otp(c, phone, "signup")
    stored = await fake_redis.get(f"otp:code:signup:sms:{phone}")
    assert stored and len(stored) == 64
    assert stored != hashlib.sha256(f"otp:signup:sms:{phone}:{OTP}".encode()).hexdigest()
    assert OTP not in stored


async def test_signup_records_consents_and_requires_age_confirmation():
    phone = new_phone()
    async with anon() as c:
        await request_otp(c, phone, "signup")
        r = await c.post("/api/v1/auth/register", json={
            "full_name": "Kid", "phone": phone, "password": PASSWORD, "otp": OTP,
            "accept_terms": True,
        })
        assert r.status_code == 422
        r = await register(c, new_phone())
        assert r.status_code == 201
        user_id = r.json()["id"]
    async with engine.connect() as conn:
        purposes = (await conn.execute(
            text("select purpose from consents where user_id = :u and withdrawn_at is null"),
            {"u": user_id},
        )).scalars().all()
    assert sorted(purposes) == ["privacy_notice", "terms"]


async def test_auth_events_are_append_only():
    async with signed_in():
        pass
    with pytest.raises(DBAPIError, match="not allowed"):
        async with engine.begin() as conn:
            await conn.execute(text("update auth_events set result = 'tampered'"))


async def test_breached_passwords_are_rejected(monkeypatch):
    monkeypatch.setattr(get_settings(), "breached_password_check", True)
    suffix = hashlib.sha1(PASSWORD.encode()).hexdigest().upper()[5:]

    class FakeResponse:
        text = f"{suffix}:42\r\nABCDEF:1"

        def raise_for_status(self):
            return None

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc):
            return False

        async def get(self, *args, **kwargs):
            return FakeResponse()

    monkeypatch.setattr(password_policy.httpx, "AsyncClient", FakeClient)
    async with anon() as c:
        r = await register(c, new_phone())
        assert r.status_code == 422 and r.json()["error"]["code"] == "breached_password"


async def test_register_requires_mixed_character_classes():
    phone = new_phone()
    async with anon() as c:
        assert (await request_otp(c, phone, "signup")).status_code == 204
        base = {"full_name": "X", "phone": phone, "otp": OTP,
                "accept_terms": True, "age_confirmed": True}
        weak = await c.post("/api/v1/auth/register", json={**base, "password": "lowercase1!"})
        assert weak.status_code == 422 and "uppercase" in weak.text
        nospecial = await c.post("/api/v1/auth/register", json={**base, "password": "NoSpecial12"})
        assert nospecial.status_code == 422 and "special character" in nospecial.text
        ok = await c.post("/api/v1/auth/register", json={**base, "password": "Strong-pass1"})
        assert ok.status_code == 201, ok.text
