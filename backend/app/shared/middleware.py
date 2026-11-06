"""Pure-ASGI request correlation middleware. Owns request_id + X-Request-ID."""
import time
import uuid

import structlog
from fastapi.responses import JSONResponse

log = structlog.get_logger()


def new_request_id() -> str:
    return str(uuid.uuid4())


class RequestContextMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        request_id = new_request_id()
        scope.setdefault("state", {})["request_id"] = request_id
        start = time.perf_counter()
        status = 500

        async def send_wrapper(message):
            nonlocal status
            if message.get("type") == "http.response.start":
                status = message.get("status", 500)
                headers = list(message.get("headers", []))
                headers.append((b"x-request-id", request_id.encode()))
                message = {**message, "headers": headers}
            await send(message)

        def emit(status_code):
            duration_ms = round((time.perf_counter() - start) * 1000, 3)
            log.info(
                "http_request",
                method=scope.get("method"),
                path=scope.get("path"),
                status=status_code,
                duration_ms=duration_ms,
            )

        try:
            with structlog.contextvars.bound_contextvars(request_id=request_id):
                try:
                    await self.app(scope, receive, send_wrapper)
                except Exception:
                    log.exception("unhandled_error")
                    body = JSONResponse(
                        status_code=500,
                        content={
                            "error": {
                                "code": "internal_error",
                                "message": "Erro interno do servidor.",
                                "request_id": request_id,
                            }
                        },
                    )
                    await body(scope, receive, send_wrapper)
                emit(status)
        except Exception:
            # Fallback if logging/emission itself fails — never break the response
            pass


class OriginCheckMiddleware:
    """Require an allow-listed Origin on state-changing methods (D-17)."""

    def __init__(self, app, allowed_origins):
        self.app = app
        self.allowed = {o.strip().rstrip("/").lower() for o in allowed_origins}

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http" or scope.get("method") not in {
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
        }:
            await self.app(scope, receive, send)
            return
        origin = None
        for key, value in scope.get("headers", []):
            if key.lower() == b"origin":
                origin = value.decode("latin-1")
                break
        if origin is None or origin.strip().rstrip("/").lower() not in self.allowed:
            request_id = scope.get("state", {}).get("request_id")
            body = JSONResponse(
                status_code=403,
                content={
                    "error": {
                        "code": "invalid_origin",
                        "message": "Origem não permitida.",
                        "request_id": request_id,
                    }
                },
            )
            await body(scope, receive, send)
            return
        await self.app(scope, receive, send)
