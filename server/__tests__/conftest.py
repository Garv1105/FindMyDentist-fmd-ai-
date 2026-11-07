import os

os.environ.update(
    APP_ENV="test",
    DB_HOST=os.environ.get("TEST_DB_HOST", "localhost"),
    DB_PORT=os.environ.get("TEST_DB_PORT", "5432"),
    DB_NAME=os.environ.get("TEST_DB_NAME", "fmd_test"),
    DB_USER=os.environ.get("TEST_DB_USER", "postgres"),
    DB_PASSWORD=os.environ.get("TEST_DB_PASSWORD", "postgres"),
    DB_SSLMODE="prefer", DB_SSLROOTCERT="",
    SECRET_KEY="test-secret-key-test-secret-key-test-secret-key",
    BREACHED_PASSWORD_CHECK="false", COOKIE_SECURE="false",
)

import pytest  # noqa: E402
from alembic.config import Config  # noqa: E402
from fakeredis import FakeAsyncRedis  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from alembic import command  # noqa: E402
from app.core import cache  # noqa: E402
from app.db.session import engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def migrate() -> None:
    command.upgrade(Config("alembic.ini"), "head")


TEST_OTP = "123456"


@pytest.fixture(autouse=True)
def fixed_otp(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.otp_service.generate_code", lambda: TEST_OTP)


@pytest.fixture(autouse=True)
def fake_redis(monkeypatch: pytest.MonkeyPatch) -> FakeAsyncRedis:
    fake = FakeAsyncRedis(decode_responses=True)
    monkeypatch.setattr(cache, "redis", fake)
    return fake


@pytest.fixture(autouse=True)
async def clean_db():
    yield
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "truncate users, dentist_profiles, clinics, clinic_memberships, invitations,"
                " sessions, auth_events, consents, mfa_methods"
            )
        )


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
