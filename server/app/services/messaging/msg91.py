import logging

import httpx

from app.core.config import get_settings
from app.core.exceptions import ServiceUnavailableError
from app.services.messaging.base import Channel

logger = logging.getLogger("app.messaging")

FLOW_URL = "https://control.msg91.com/api/v5/flow"


class Msg91Sender:
    def __init__(self) -> None:
        settings = get_settings()
        assert settings.msg91_auth_key
        self.auth_key = settings.msg91_auth_key.get_secret_value()
        self.templates = settings.msg91_templates

    async def send_otp(self, phone: str, code: str, purpose: str) -> Channel:
        await self._send(phone, "otp", {"otp": code})
        return "sms"

    async def notify(self, phone: str, template: str, params: dict[str, str]) -> None:
        if template not in self.templates:
            logger.warning("No MSG91 template for %s; notification skipped", template)
            return
        try:
            await self._send(phone, template, params)
        except ServiceUnavailableError:
            logger.exception("MSG91 notification %s failed", template)

    async def _send(self, phone: str, template: str, params: dict[str, str]) -> None:
        body = {
            "template_id": self.templates[template],
            "short_url": "0",
            "recipients": [{"mobiles": phone.removeprefix("+"), **params}],
        }
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.post(FLOW_URL, json=body, headers={"authkey": self.auth_key})
            ok = r.status_code == 200 and r.json().get("type") == "success"
        except (httpx.HTTPError, ValueError):
            logger.exception("MSG91 request failed")
            ok = False
        else:
            if not ok:
                logger.error("MSG91 rejected %s: %s %s", template, r.status_code, r.text[:500])
        if not ok:
            raise ServiceUnavailableError("We couldn't send the SMS. Please try again shortly.")
