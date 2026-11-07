import asyncio
import logging
from functools import lru_cache
from typing import Protocol

import boto3

from app.core.config import get_settings

logger = logging.getLogger("app.email")


class Mailer(Protocol):
    async def send(self, to: str, subject: str, text: str) -> None: ...


class LogMailer:
    async def send(self, to: str, subject: str, text: str) -> None:
        logger.warning("DEV email to %s: %s\n%s", to, subject, text)


class SesMailer:
    def __init__(self) -> None:
        settings = get_settings()
        self.sender = settings.email_from
        self.client = boto3.client("sesv2", region_name=settings.aws_region)

    async def send(self, to: str, subject: str, text: str) -> None:
        await asyncio.to_thread(
            self.client.send_email,
            FromEmailAddress=self.sender,
            Destination={"ToAddresses": [to]},
            Content={"Simple": {
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {"Text": {"Data": text, "Charset": "UTF-8"}},
            }},
        )


@lru_cache
def get_mailer() -> Mailer:
    return SesMailer() if get_settings().email_provider == "ses" else LogMailer()
