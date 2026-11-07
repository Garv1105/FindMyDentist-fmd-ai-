import uuid

import jwt

from app.core.config import get_settings
from app.core.security import create_access_token, decode_access_token

from .helpers import anon, new_phone, register, signed_in

ME = "/api/v1/auth/me"
REFRESH = "/api/v1/auth/refresh"


def tokens(c) -> tuple[str, str]:
    s = get_settings()
    return c.cookies[s.access_cookie_name], c.cookies[s.refresh_cookie_name]


async def test_login_issues_short_lived_access_jwt_and_bearer_works():
    async with signed_in() as c:
        access, _ = tokens(c)
        claims = decode_access_token(access)
        assert claims["exp"] - claims["iat"] == get_settings().access_token_minutes * 60
        assert uuid.UUID(claims["sub"]) and uuid.UUID(claims["sid"])
        async with anon() as api_client:
            r = await api_client.get(ME, headers={"Authorization": f"Bearer {access}"})
            assert r.status_code == 200


async def test_forged_and_expired_access_tokens_are_rejected(monkeypatch):
    async with signed_in() as c:
        claims = decode_access_token(tokens(c)[0])
        forged = jwt.encode(claims, "an-attacker-key-that-is-long-enough-x", algorithm="HS256")
        none_alg = jwt.encode(claims, None, algorithm="none")
        monkeypatch.setattr(get_settings(), "access_token_minutes", -1)
        expired = create_access_token(uuid.UUID(claims["sub"]), uuid.UUID(claims["sid"]))
        async with anon() as other:
            for bad in (forged, none_alg, expired, "garbage"):
                r = await other.get(ME, headers={"Authorization": f"Bearer {bad}"})
                assert r.status_code == 401, bad


async def test_refresh_rotates_and_reuse_after_grace_revokes_the_session(monkeypatch):
    async with signed_in() as c:
        _, first_refresh = tokens(c)
        assert (await c.post(REFRESH)).status_code == 204
        _, second_refresh = tokens(c)
        assert second_refresh != first_refresh

        async with anon() as racing_tab:
            racing_tab.cookies.set(get_settings().refresh_cookie_name, first_refresh)
            r = await racing_tab.post(REFRESH)
            assert r.status_code == 204
            assert get_settings().refresh_cookie_name not in r.cookies

        monkeypatch.setattr(get_settings(), "refresh_reuse_grace_seconds", -1)
        async with anon() as thief:
            thief.cookies.set(get_settings().refresh_cookie_name, first_refresh)
            assert (await thief.post(REFRESH)).status_code == 401

        assert (await c.get(ME)).status_code == 401
        assert (await c.post(REFRESH)).status_code == 401


async def test_logout_kills_refresh_and_access_at_once():
    async with signed_in() as c:
        access, refresh = tokens(c)
        assert (await c.post("/api/v1/auth/logout")).status_code == 204
        async with anon() as replay:
            r = await replay.get(ME, headers={"Authorization": f"Bearer {access}"})
            assert r.status_code == 401
            replay.cookies.set(get_settings().refresh_cookie_name, refresh)
            assert (await replay.post(REFRESH)).status_code == 401


async def test_access_cookie_expires_before_the_jwt_so_the_proxy_refreshes_in_time():
    async with anon() as c:
        r = await register(c, new_phone())
        header = next(h for h in r.headers.get_list("set-cookie")
                      if h.startswith(get_settings().access_cookie_name))
        claims = decode_access_token(tokens(c)[0])
        assert f"Max-Age={claims['exp'] - claims['iat'] - 60}" in header


async def test_revocation_does_not_depend_on_redis(fake_redis):
    async with signed_in() as c:
        access, _ = tokens(c)
        assert (await c.post("/api/v1/auth/logout")).status_code == 204
        await fake_redis.flushall()
        async with anon() as replay:
            r = await replay.get(ME, headers={"Authorization": f"Bearer {access}"})
            assert r.status_code == 401


async def test_logout_without_refresh_cookie_revokes_via_access_token():
    async with signed_in() as c:
        access, refresh = tokens(c)
        async with anon() as only_access:
            r = await only_access.post("/api/v1/auth/logout",
                                       headers={"Authorization": f"Bearer {access}"})
            assert r.status_code == 204
        assert (await c.get(ME)).status_code == 401
        assert (await c.post(REFRESH)).status_code == 401


async def test_logging_in_again_revokes_the_replaced_session():
    async with signed_in() as c:
        old_access, old_refresh = tokens(c)
        r = await c.post("/api/v1/auth/login/password",
                         json={"login": c.phone, "password": "Correct-horse1"})
        assert r.status_code == 200, r.text
        assert tokens(c)[1] != old_refresh
        assert (await c.get(ME)).status_code == 200
        async with anon() as replay:
            r = await replay.get(ME, headers={"Authorization": f"Bearer {old_access}"})
            assert r.status_code == 401
            replay.cookies.set(get_settings().refresh_cookie_name, old_refresh)
            assert (await replay.post(REFRESH)).status_code == 401
