"""D-19 error envelope and the closed D-22 code set."""
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class ErrorCode:
    VALIDATION_ERROR = "validation_error"
    EMAIL_ALREADY_EXISTS = "email_already_exists"
    INVALID_CREDENTIALS = "invalid_credentials"
    NOT_AUTHENTICATED = "not_authenticated"
    FORBIDDEN = "forbidden"
    INVALID_ORIGIN = "invalid_origin"
    INTERNAL_ERROR = "internal_error"


ERROR_MESSAGES: dict[str, str] = {
    ErrorCode.VALIDATION_ERROR: "Dados inválidos.",
    ErrorCode.EMAIL_ALREADY_EXISTS: "E-mail já cadastrado.",
    ErrorCode.INVALID_CREDENTIALS: "Credenciais inválidas.",
    ErrorCode.NOT_AUTHENTICATED: "Não autenticado.",
    ErrorCode.FORBIDDEN: "Acesso negado.",
    ErrorCode.INVALID_ORIGIN: "Origem não permitida.",
    ErrorCode.INTERNAL_ERROR: "Erro interno do servidor.",
}

_PORTUGUESE_REASONS = {
    "missing": "obrigatório",
    "string_too_short": "mínimo de {ctx} caracteres",
    "string_too_long": "máximo de {ctx} caracteres",
    "extra_forbidden": "campo não permitido",
    "value_error": "e-mail inválido",
    "literal_error": "deve ser um de: {ctx}",
}


def envelope(request: Request, status: int, code: str, message: str) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message, "request_id": request_id}},
    )


def register_handlers(app: FastAPI) -> None:
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        raw = str(exc.detail) if isinstance(exc.detail, str) else ""
        code = raw if raw in ERROR_MESSAGES else ErrorCode.INTERNAL_ERROR
        message = ERROR_MESSAGES[code]
        return envelope(request, exc.status_code, code, message)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        parts = []
        for err in exc.errors():
            loc = ".".join(str(p) for p in err.get("loc", []) if p != "body")
            reason = _PORTUGUESE_REASONS.get(err.get("type", ""), err.get("msg", "inválido"))
            if isinstance(reason, str) and "{ctx}" in reason:
                ctx = err.get("ctx", {})
                limit = ctx.get("min_length") or ctx.get("max_length") or ctx.get("expected") or ""
                if isinstance(limit, str):
                    limit = limit.replace(" or ", " ou ")
                reason = reason.format(ctx=limit)
            parts.append(f"{loc}: {reason}" if loc else reason)
        message = "; ".join(parts) if parts else ERROR_MESSAGES[ErrorCode.VALIDATION_ERROR]
        return envelope(request, 422, ErrorCode.VALIDATION_ERROR, message)
