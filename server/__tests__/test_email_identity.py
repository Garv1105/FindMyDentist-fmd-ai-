import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.db.session import engine

from .helpers import OTP, anon, signed_in

_seq = iter(range(9100000001, 9100009999))


async def _mk(conn, email, verified):
    await conn.execute(
        text(
            "insert into users (id, phone, email, full_name, email_verified_at) "
            "values (:id, :phone, :email, 'T', :v)"
        ),
        {
            "id": uuid.uuid7(),
            "phone": f"+91{next(_seq)}",
            "email": email,
            "v": datetime.now(UTC) if verified else None,
        },
    )


async def test_two_unverified_with_same_email_allowed():
    async with engine.begin() as conn:
        await _mk(conn, "dup@x.com", False)
        await _mk(conn, "dup@x.com", False)


async def test_only_one_verified_email_allowed():
    async with engine.begin() as conn:
        await _mk(conn, "v@x.com", True)
    with pytest.raises(IntegrityError):
        async with engine.begin() as conn:
            await _mk(conn, "v@x.com", True)


async def add_email(c, email, password=None):
    body = {"email": email} | ({"password": password} if password else {})
    return await c.post("/api/v1/me/email", json=body)


async def verify_email(c):
    return await c.post("/api/v1/me/email/verify", json={"code": OTP})


async def test_add_and_verify_email_then_it_shows_on_me():
    async with signed_in() as c:
        assert (await add_email(c, "me@x.com")).status_code == 204
        assert (await verify_email(c)).status_code == 204
        me = (await c.get("/api/v1/auth/me")).json()
        assert me["email"] == "me@x.com" and me["email_verified"] is True


async def test_unverified_email_is_not_a_login_identifier():
    async with signed_in() as c:
        assert (await add_email(c, "unv@x.com")).status_code == 204
    async with anon() as b:
        r = await b.post("/api/v1/auth/login/password",
                         json={"login": "unv@x.com", "password": "Correct-horse1"})
        assert r.status_code == 401


async def test_verify_email_already_verified_elsewhere_conflicts(fake_redis):
    async with signed_in() as a:
        await add_email(a, "shared@x.com")
        assert (await verify_email(a)).status_code == 204
    await fake_redis.flushall()
    async with signed_in() as b:
        await add_email(b, "shared@x.com")
        assert (await verify_email(b)).status_code == 409


async def test_removing_email_frees_it_for_others(fake_redis):
    async with signed_in() as a:
        await add_email(a, "free@x.com")
        await verify_email(a)
        assert (await a.request("DELETE", "/api/v1/me/email",
                                json={"password": "Correct-horse1"})).status_code == 204
    await fake_redis.flushall()
    async with signed_in() as b:
        await add_email(b, "free@x.com")
        assert (await verify_email(b)).status_code == 204


async def test_change_and_remove_email_require_password():
    async with signed_in() as c:
        await add_email(c, "first@x.com")
        await verify_email(c)
        assert (await add_email(c, "second@x.com")).status_code == 401
        assert (await add_email(c, "second@x.com", password="Correct-horse1")).status_code == 204
        assert (await c.request("DELETE", "/api/v1/me/email", json={})).status_code == 401


async def _verified_email(c, email):
    await add_email(c, email)
    await verify_email(c)


async def test_login_otp_to_email_requires_verified():
    async with signed_in() as c:
        await add_email(c, "lo@x.com")
    async with anon() as b:
        r = await b.post("/api/v1/auth/otp", json={"identifier": "lo@x.com", "purpose": "login"})
        assert r.status_code == 404


async def test_login_with_otp_by_verified_email(fake_redis):
    async with signed_in() as c:
        await _verified_email(c, "lo2@x.com")
    await fake_redis.flushall()
    async with anon() as b:
        body = {"identifier": "lo2@x.com", "purpose": "login"}
        assert (await b.post("/api/v1/auth/otp", json=body)).status_code == 204
        r = await b.post("/api/v1/auth/login/otp", json={"identifier": "lo2@x.com", "code": OTP})
        assert r.status_code == 200
        assert (await b.get("/api/v1/auth/me")).json()["email"] == "lo2@x.com"


async def test_forgot_password_by_verified_email(fake_redis):
    async with signed_in() as c:
        await _verified_email(c, "fp@x.com")
    await fake_redis.flushall()
    async with anon() as b:
        await b.post("/api/v1/auth/otp",
                     json={"identifier": "fp@x.com", "purpose": "reset_password"})
        proof = (await b.post("/api/v1/auth/otp/verify",
                 json={"identifier": "fp@x.com", "purpose": "reset_password",
                       "code": OTP})).json()["proof_token"]
        assert (await b.post("/api/v1/auth/password/reset",
                json={"identifier": "fp@x.com", "proof_token": proof,
                      "new_password": "New-horse-123"})).status_code == 204


async def test_email_otp_is_rate_limited(fake_redis):
    async with signed_in() as c:
        await _verified_email(c, "rl@x.com")
    await fake_redis.flushall()
    async with anon() as b:
        body = {"identifier": "rl@x.com", "purpose": "login"}
        assert (await b.post("/api/v1/auth/otp", json=body)).status_code == 204
        assert (await b.post("/api/v1/auth/otp", json=body)).status_code == 429
