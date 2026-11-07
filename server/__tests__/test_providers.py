import json

import httpx
import pytest
from pydantic import SecretStr

from app.core.config import get_settings
from app.core.exceptions import ServiceUnavailableError
from app.services.messaging.msg91 import FLOW_URL, Msg91Sender


def msg91(monkeypatch, reply: httpx.Response, sent: list[httpx.Request]) -> Msg91Sender:
    settings = get_settings()
    monkeypatch.setattr(settings, "msg91_auth_key", SecretStr("test-key"))
    monkeypatch.setattr(settings, "msg91_templates", {"otp": "tpl-otp"})
    real_client = httpx.AsyncClient

    def handler(request: httpx.Request) -> httpx.Response:
        sent.append(request)
        return reply

    monkeypatch.setattr(
        httpx, "AsyncClient",
        lambda **kw: real_client(transport=httpx.MockTransport(handler), **kw),
    )
    return Msg91Sender()


async def test_msg91_sends_otp_through_dlt_flow_template(monkeypatch):
    sent: list[httpx.Request] = []
    sender = msg91(monkeypatch, httpx.Response(200, json={"type": "success"}), sent)
    assert await sender.send_otp("+919876543210", "123456", "login") == "sms"
    assert str(sent[0].url) == FLOW_URL
    assert sent[0].headers["authkey"] == "test-key"
    assert json.loads(sent[0].content) == {
        "template_id": "tpl-otp",
        "short_url": "0",
        "recipients": [{"mobiles": "919876543210", "otp": "123456"}],
    }


async def test_msg91_failure_is_a_503_and_missing_notify_template_is_skipped(monkeypatch):
    sent: list[httpx.Request] = []
    sender = msg91(monkeypatch, httpx.Response(200, json={"type": "error"}), sent)
    with pytest.raises(ServiceUnavailableError):
        await sender.send_otp("+919876543210", "123456", "login")
    await sender.notify("+919876543210", "password_changed", {"name": "A"})
    assert len(sent) == 1
