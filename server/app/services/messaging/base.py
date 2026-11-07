from typing import Literal, Protocol

Channel = Literal["sms", "whatsapp", "log", "email"]


class Sender(Protocol):
    async def send_otp(self, phone: str, code: str, purpose: str) -> Channel: ...

    async def notify(self, phone: str, template: str, params: dict[str, str]) -> None: ...
