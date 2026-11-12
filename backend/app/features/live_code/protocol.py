"""Pure frame parse/build for the live channel wire protocol.

No I/O, no socket imports — unit tests run DB/socket-free. Inbound frames
carry no echoed payload: parse errors name no client-controlled text.
"""
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal

from app.shared.errors import ERROR_MESSAGES

FrameType = Literal["join", "code_update", "presence", "snapshot", "error"]
SUPPORTED_INBOUND = frozenset({"join", "code_update"})


@dataclass(frozen=True)
class Frame:
    type: str
    content: str | None = None  # inbound code_update payload carrier (D-08)


class FrameError(Exception):
    """Inbound frame is not a supported type or is malformed. Carries no payload."""


def parse_frame(raw: object) -> Frame:
    """Accept only ``{"type": "join"}`` and ``{"type": "code_update", "content"}``.

    ``join`` carries no payload; ``code_update`` requires a string ``content``
    (missing or non-string content raises FrameError, D-08). Anything else —
    non-object payloads, unknown or unsupported ``type`` values, wrong casing
    or padding — raises FrameError.
    """
    if not isinstance(raw, Mapping):
        raise FrameError("frame must be an object")
    frame_type = raw.get("type")
    if not isinstance(frame_type, str) or frame_type != frame_type.strip():
        raise FrameError("unsupported frame type")
    if frame_type not in SUPPORTED_INBOUND:
        raise FrameError("unsupported frame type")
    if frame_type == "code_update":
        content = raw.get("content")
        if not isinstance(content, str):
            raise FrameError("code_update requires a string content")
        return Frame(type="code_update", content=content)
    return Frame(type=frame_type)


def snapshot_frame(room_id, content: str, language: str, content_hash: str, request_id: str) -> dict:
    """Build the snapshot frame sent to the joiner only (D-04..D-07)."""
    return {
        "type": "snapshot",
        "room_id": str(room_id),
        "content": content,
        "language": language,
        "content_hash": content_hash,
        "request_id": request_id,
    }


def code_update_broadcast_frame(room_id, content: str, content_hash: str, request_id: str) -> dict:
    """Build the code_update broadcast frame for all joined sockets (D-09).

    The frame carries no sender-only fields; ``request_id`` is the
    recipient's own when built through ``hub.broadcast``.
    """
    return {
        "type": "code_update",
        "room_id": str(room_id),
        "content": content,
        "content_hash": content_hash,
        "request_id": request_id,
    }


def presence_frame(room_id, count: int, role: str, request_id: str) -> dict:
    """Build the presence frame; role is the receiving socket's own role."""
    return {
        "type": "presence",
        "room_id": str(room_id),
        "count": count,
        "role": role,
        "request_id": request_id,
    }


def error_frame(code: str, request_id: str, *, message: str | None = None) -> dict:
    """Build the error frame as the REST envelope verbatim (D-14).

    ``message`` is an optional keyword-only Portuguese override (D-02: the
    oversize refusal names the 256 KiB limit). When omitted,
    ``ERROR_MESSAGES[code]`` is used unchanged.
    """
    return {
        "error": {
            "code": code,
            "message": ERROR_MESSAGES[code] if message is None else message,
            "request_id": request_id,
        }
    }
