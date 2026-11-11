"""Unit: wire contract for the live channel. No database, no sockets."""
import typing
import uuid

import pytest

from app.features.live_code import protocol
from app.features.live_code.protocol import (
    SUPPORTED_INBOUND,
    Frame,
    FrameError,
    error_frame,
    parse_frame,
    presence_frame,
)
from app.shared.errors import ERROR_MESSAGES


def test_join_frame_parses():
    frame = parse_frame({"type": "join"})
    assert frame == Frame(type="join")
    assert frame.type == "join"


@pytest.mark.parametrize(
    "raw",
    [
        {"type": "code_update"},
        {"type": "presence"},
        {"type": "snapshot"},
        {"type": "error"},
        {"type": "JOIN"},
        {"type": " join"},
        {"type": "join "},
        {"type": ""},
        {},
        {"type": 1},
        {"type": None},
        [],
        1,
        "join",
        None,
    ],
)
def test_unsupported_inbound_raises_frame_error(raw):
    with pytest.raises(FrameError):
        parse_frame(raw)


def test_supported_inbound_is_exactly_join():
    assert SUPPORTED_INBOUND == frozenset({"join"})


def test_parse_frame_never_echoes_payload():
    offending = "super-secret-value"
    with pytest.raises(FrameError) as exc_info:
        parse_frame({"type": offending})
    assert offending not in str(exc_info.value)
    with pytest.raises(FrameError) as exc_info:
        parse_frame(offending)
    assert offending not in str(exc_info.value)


def test_presence_frame_keys():
    room_id = uuid.uuid4()
    frame = presence_frame(room_id, 3, "viewer", "req-1")
    assert set(frame) == {"type", "room_id", "count", "role", "request_id"}
    assert frame == {
        "type": "presence",
        "room_id": str(room_id),
        "count": 3,
        "role": "viewer",
        "request_id": "req-1",
    }
    assert presence_frame(str(room_id), 3, "viewer", "req-1") == frame
    assert not {"nickname", "user_id", "users", "roster"} & set(frame)


def test_error_envelope_shape():
    code = next(iter(ERROR_MESSAGES))
    frame = error_frame(code, "req-1")
    assert set(frame) == {"error"}
    assert set(frame["error"]) == {"code", "message", "request_id"}
    assert frame["error"]["code"] == code
    assert frame["error"]["message"] == ERROR_MESSAGES[code]
    assert frame["error"]["request_id"] == "req-1"


def test_error_frame_unknown_code_raises_key_error():
    with pytest.raises(KeyError):
        error_frame("not_a_real_code", "req-1")


def test_no_snapshot_builder():
    import inspect

    for name, obj in vars(protocol).items():
        if inspect.isfunction(obj):
            assert "snapshot" not in name
            assert "snapshot" not in inspect.getsource(obj)
    assert typing.get_args(protocol.FrameType) == ("join", "code_update", "presence", "snapshot", "error")


def test_module_purity():
    import inspect

    source = inspect.getsource(protocol)
    assert "await" not in source
    assert "WebSocket" not in source
    assert "AsyncSession" not in source
