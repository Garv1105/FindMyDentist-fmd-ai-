from functools import lru_cache

from app.core.config import get_settings
from app.services.messaging.base import Channel, Sender
from app.services.messaging.log import LogSender
from app.services.messaging.msg91 import Msg91Sender


@lru_cache
def get_sender() -> Sender:
    if get_settings().sms_provider == "msg91":
        return Msg91Sender()
    return LogSender()


__all__ = ["Channel", "Sender", "get_sender"]
