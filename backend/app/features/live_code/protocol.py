"""Pure frame parse/build for the live channel wire protocol.

No I/O, no socket imports — unit tests run DB/socket-free. Inbound frames
carry no echoed payload: parse errors name no client-controlled text.
"""
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Literal

from app.shared.errors import ERROR_MESSAGES

FrameType = Literal["join", "code_update", "presence", "snapshot", "error"]
SUPPORTED_INBOUND = frozenset({"join"})


@dataclass(frozen=True)
class Frame:
    type: str


class FrameError(Exception):
    """Inbound frame is not a supported type. Message carries no payload."""


def parse_frame(raw: object) -> Frame:
    """Accept only ``{"type": "join"}`` (Phase 3, A-01/A-02).

    Anything else — non-object payloads, unknown or unsupported ``type``
    values, wrong casing or padding — raises FrameError.
    """
    if not isinstance(raw, Mapping):
        raise FrameError("frame must be an object")
    frame_type = raw.get("type")
    if not isinstance(frame_type, str) or frame_type != frame_type.strip():
        raise FrameError("unsupported frame type")
    if frame_type not in SUPPORTED_INBOUND:
        raise FrameError("unsupported frame type")
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


def presence_frame(room_id, count: int, role: str, request_id: str) -> dict:
    """Build the presence frame; role is the receiving socket's own role."""
    return {
        "type": "presence",
        "room_id": str(room_id),
        "count": count,
        "role": role,
        "request_id": request_id,
    }


def error_frame(code: str, request_id: str) -> dict:
    """Build the error frame as the REST envelope verbatim (D-14)."""
    return {
        "error": {
            "code": code,
            "message": ERROR_MESSAGES[code],
            "request_id": request_id,
        }
    }
