"""Unit: Portuguese 422 messages for Literal and length limits. No database."""
from typing import Literal

import httpx
from fastapi import FastAPI
from pydantic import BaseModel, ConfigDict, Field

from app.shared.errors import register_handlers
from app.shared.middleware import RequestContextMiddleware

EXPECTED_LITERAL_MESSAGE = (
    "language: deve ser um de: 'python', 'java', 'c', 'php' ou 'javascript'"
)


class LanguageProbe(BaseModel):
    model_config = ConfigDict(extra="forbid")
    language: Literal["python", "java", "c", "php", "javascript"]


class PasswordProbe(BaseModel):
    model_config = ConfigDict(extra="forbid")
    password: str = Field(min_length=8)


def _make_app():
    probe = FastAPI()
    probe.add_middleware(RequestContextMiddleware)
    register_handlers(probe)

    @probe.post("/probe")
    async def _probe_language(data: LanguageProbe):
        return {"language": data.language}

    @probe.post("/probe-password")
    async def _probe_password(data: PasswordProbe):
        return {"ok": True}

    return probe


async def _post(app, path, payload):
    transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="https://test") as ac:
        return await ac.post(path, json=payload)


async def test_literal_error_is_portuguese():
    resp = await _post(_make_app(), "/probe", {"language": "rust"})
    assert resp.status_code == 422
    body = resp.json()
    assert body["error"]["code"] == "validation_error"
    assert body["error"]["message"] == EXPECTED_LITERAL_MESSAGE
    assert "Input should be" not in resp.text
    assert "literal_error" not in resp.text


async def test_literal_error_is_case_sensitive():
    resp = await _post(_make_app(), "/probe", {"language": "Python"})
    assert resp.status_code == 422
    assert resp.json()["error"]["message"] == EXPECTED_LITERAL_MESSAGE


async def test_extra_field_still_portuguese():
    resp = await _post(_make_app(), "/probe", {"language": "c", "title": "x"})
    assert resp.status_code == 422
    assert "campo não permitido" in resp.json()["error"]["message"]


async def test_length_limit_still_renders_number():
    resp = await _post(_make_app(), "/probe-password", {"password": "1234"})
    assert resp.status_code == 422
    assert "mínimo de 8 caracteres" in resp.json()["error"]["message"]


async def test_valid_literal_succeeds():
    resp = await _post(_make_app(), "/probe", {"language": "c"})
    assert resp.status_code == 200
    assert resp.json()["language"] == "c"
