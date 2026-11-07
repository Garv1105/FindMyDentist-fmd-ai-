import re
from urllib.parse import urlsplit

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.config import get_settings

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def _origin_of(url: str) -> str:
    parts = urlsplit(url)
    return f"{parts.scheme}://{parts.netloc}"


class OriginCheckMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http" and scope["method"] not in SAFE_METHODS:
            settings = get_settings()
            headers = {k.decode().lower(): v.decode() for k, v in scope["headers"]}
            source = headers.get("origin") or (
                _origin_of(headers["referer"]) if "referer" in headers else None
            )
            if source is None:
                allowed = settings.app_env != "production"
            else:
                pattern = settings.allowed_origin_regex
                allowed = source in settings.allowed_origins or bool(
                    pattern and re.fullmatch(pattern, source)
                )
            if not allowed:
                response = JSONResponse(
                    {"error": {"code": "forbidden", "message": "Request origin not allowed"}},
                    status_code=403,
                )
                await response(scope, receive, send)
                return
        await self.app(scope, receive, send)
