import ssl
from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "FMD API"
    app_env: Literal["local", "test", "staging", "production"] = "local"
    # where emailed clinic invitations open: the FMD app (web/), at /invite/{token}
    clinic_os_url: str = "http://localhost:3000"
    invite_ttl_days: int = 7

    redis_url: str = "redis://localhost:6379/0"

    sms_provider: Literal["log", "msg91"] = "log"
    msg91_auth_key: SecretStr | None = None
    msg91_templates: dict[str, str] = {}

    email_provider: Literal["log", "ses"] = "log"
    email_from: str = "FMD <no-reply@fmd.in>"
    aws_region: str = "ap-south-1"

    otp_ttl_minutes: int = 10
    otp_max_attempts: int = 5
    otp_resend_seconds: int = 30
    otp_hourly_limit: int = 5
    otp_daily_limit: int = 10
    otp_ip_hourly_limit: int = 30
    otp_allowed_country_codes: list[str] = ["+91"]
    proof_ttl_minutes: int = 10
    mfa_challenge_ttl_minutes: int = 5

    login_max_failures: int = 10
    login_lockout_minutes: int = 15
    login_ip_hourly_limit: int = 100
    breached_password_check: bool = True

    notice_version: str = "2026-10-22"

    db_host: str = "localhost"
    db_port: int = 5432
    db_name: str = "fmd"
    db_user: str = "postgres"
    db_password: SecretStr = SecretStr("postgres")
    db_sslmode: str = "prefer"
    db_sslrootcert: str | None = None
    db_pool_size: int = 5
    db_max_overflow: int = 10
    db_pool_recycle_seconds: int = 1800
    db_connect_timeout_seconds: int = 5
    db_statement_timeout_ms: int = 15_000

    secret_key: SecretStr = Field(min_length=32)

    access_cookie_name: str = "fmd_access"
    refresh_cookie_name: str = "fmd_refresh"
    access_token_minutes: int = 15
    jwt_issuer: str = "fmd-api"
    jwt_audience: str = "fmd"
    refresh_reuse_grace_seconds: int = 30
    session_idle_days: int = 14
    session_absolute_days: int = 60
    cookie_secure: bool = True
    cookie_domain: str | None = None
    cors_origins: list[str] = []
    allowed_origins: list[str] = ["http://localhost:3000", "http://localhost:3001"]
    # also allowed: an origin this whole pattern matches, e.g. Vercel previews:
    # https://find-my-dentist-[a-z0-9-]+-garv-0cc1\.vercel\.app
    allowed_origin_regex: str | None = None

    @model_validator(mode="after")
    def _real_providers_in_production(self) -> Settings:
        if self.app_env == "production" and "log" in (self.sms_provider, self.email_provider):
            raise ValueError("SMS_PROVIDER and EMAIL_PROVIDER must be real in production")
        if self.sms_provider == "msg91" and not (self.msg91_auth_key and self.msg91_templates):
            raise ValueError("MSG91_AUTH_KEY and MSG91_TEMPLATES are required for msg91")
        return self

    @property
    def database_url(self) -> URL:
        return URL.create(
            "postgresql+asyncpg",
            username=self.db_user,
            password=self.db_password.get_secret_value(),
            host=self.db_host,
            port=self.db_port,
            database=self.db_name,
        )

    @property
    def db_ssl(self) -> str | ssl.SSLContext:
        if self.db_sslrootcert:
            return ssl.create_default_context(cafile=self.db_sslrootcert)
        return self.db_sslmode


@lru_cache
def get_settings() -> Settings:
    return Settings()  
