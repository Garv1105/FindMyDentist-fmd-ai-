from sqlalchemy import text

from app.db.session import engine
from app.services.mfa import SmsFactor, get_factor

from .helpers import OTP, anon, signed_in


async def _enable_mfa(phone: str) -> None:
    async with engine.begin() as conn:
        uid = await conn.scalar(text("select id from users where phone = :p"), {"p": phone})
        await conn.execute(text("update users set mfa_enabled = true where id = :u"), {"u": uid})
        await conn.execute(
            text(
                "insert into mfa_methods (id, user_id, kind, is_default, confirmed_at, created_at) "
                "values (gen_random_uuid(), :u, 'sms', true, now(), now())"
            ),
            {"u": uid},
        )


async def test_me_exposes_mfa_defaults_off():
    async with signed_in() as c:
        me = (await c.get("/api/v1/auth/me")).json()
        assert me["mfa_enabled"] is False and me["mfa_method"] is None


def test_registry_selects_sms():
    assert isinstance(get_factor("sms"), SmsFactor)


async def test_password_login_with_mfa_returns_challenge_not_session():
    async with signed_in() as web:
        phone = web.phone
        await _enable_mfa(phone)
    async with anon() as c:
        r = await c.post("/api/v1/auth/login/password",
                         json={"login": phone, "password": "Correct-horse1"})
        assert r.status_code == 200 and r.json()["mfa_required"] is True
        assert "fmd_access" not in r.cookies and "fmd_refresh" not in r.cookies
        assert (await c.get("/api/v1/auth/me")).status_code == 401
        token = r.json()["challenge_token"]
        r2 = await c.post("/api/v1/auth/mfa/verify",
                          json={"challenge_token": token, "code": OTP})
        assert r2.status_code == 200
        assert (await c.get("/api/v1/auth/me")).json()["phone"] == phone


async def test_otp_login_is_not_gated_by_mfa():
    async with signed_in() as web:
        phone = web.phone
        await _enable_mfa(phone)
    async with anon() as c:
        await c.post("/api/v1/auth/otp", json={"identifier": phone, "purpose": "login"})
        r = await c.post("/api/v1/auth/login/otp", json={"identifier": phone, "code": OTP})
        assert r.status_code == 200 and (await c.get("/api/v1/auth/me")).status_code == 200


async def test_mfa_verify_rejects_bad_or_reused_challenge():
    async with signed_in() as web:
        phone = web.phone
        await _enable_mfa(phone)
    async with anon() as c:
        r = await c.post("/api/v1/auth/login/password",
                         json={"login": phone, "password": "Correct-horse1"})
        token = r.json()["challenge_token"]
        assert (await c.post("/api/v1/auth/mfa/verify",
                json={"challenge_token": "x" * 40, "code": OTP})).status_code == 401
        assert (await c.post("/api/v1/auth/mfa/verify",
                json={"challenge_token": token, "code": OTP})).status_code == 200
        assert (await c.post("/api/v1/auth/mfa/verify",
                json={"challenge_token": token, "code": OTP})).status_code == 401


async def test_mfa_code_attempts_are_capped():
    from app.core.config import get_settings

    async with signed_in() as web:
        phone = web.phone
        await _enable_mfa(phone)
    async with anon() as c:
        r = await c.post("/api/v1/auth/login/password",
                         json={"login": phone, "password": "Correct-horse1"})
        token = r.json()["challenge_token"]
        for _ in range(get_settings().otp_max_attempts):
            assert (await c.post("/api/v1/auth/mfa/verify",
                    json={"challenge_token": token, "code": "000000"})).status_code == 401
        assert (await c.post("/api/v1/auth/mfa/verify",
                json={"challenge_token": token, "code": OTP})).status_code == 401


async def test_enable_requires_factor_code_then_me_shows_on():
    async with signed_in() as c:
        assert (await c.post("/api/v1/me/mfa/start")).status_code == 204
        assert (await c.post("/api/v1/me/mfa", json={"code": "000000"})).status_code == 401
        assert (await c.post("/api/v1/me/mfa", json={"code": OTP})).status_code == 204
        me = (await c.get("/api/v1/auth/me")).json()
        assert me["mfa_enabled"] is True and me["mfa_method"] == "sms"
        assert me["mfa_methods"] == ["sms"]


async def test_disable_requires_password():
    async with signed_in() as c:
        await c.post("/api/v1/me/mfa/start")
        await c.post("/api/v1/me/mfa", json={"code": OTP})
        assert (await c.request("DELETE", "/api/v1/me/mfa", json={})).status_code == 401
        assert (await c.request("DELETE", "/api/v1/me/mfa",
                json={"password": "Correct-horse1"})).status_code == 204
        assert (await c.get("/api/v1/auth/me")).json()["mfa_enabled"] is False
