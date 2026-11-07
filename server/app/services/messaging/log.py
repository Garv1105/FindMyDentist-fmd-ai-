import logging

from app.services.messaging.base import Channel

logger = logging.getLogger("app.messaging")


class LogSender:
    async def send_otp(self, phone: str, code: str, purpose: str) -> Channel:
        logger.warning("DEV OTP for %s (%s): %s", phone, purpose, code)
        return "log"

    async def notify(self, phone: str, template: str, params: dict[str, str]) -> None:
        logger.warning("DEV notification to %s: %s %s", phone, template, params)
