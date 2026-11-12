"""Unit: wire contract for the live channel. No database, no sockets."""
import typing
import uuid

import pytest

from app.features.live_code import protocol
from app.features.live_code.protocol import (
    SUPPORTED_INBOUND,
    Frame,
    FrameError,
    code_update_broadcast_frame,
    error_frame,
    parse_frame,
    presence_frame,
    snapshot_frame,
)
from app.shared.errors import ERROR_MESSAGES, ErrorCode


def test_join_frame_parses():
    frame = parse_frame({"type": "join"})
    assert frame == Frame(type="join")
    assert frame.type == "join"
    assert frame.content is None  # join frames carry no content (D-08)


@pytest.mark.parametrize(
    "raw",
    [
        # D-08-mandated revision: `{"type": "code_update"}` still raises
        # FrameError, now because `content` is missing — not because the
        # type is unsupported (code_update is supported since D-08).
        {"type": "code_update"},
        {"type": "code_update", "content": None},
        {"type": "code_update", "content": 42},
        {"type": "code_update", "content": []},
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


def test_code_update_frame_parses_with_content():
    frame = parse_frame({"type": "code_update", "content": "print('x')"})
    assert frame == Frame(type="code_update", content="print('x')")
    assert frame.type == "code_update"
    assert frame.content == "print('x')"


def test_code_update_frame_accepts_empty_content():
    frame = parse_frame({"type": "code_update", "content": ""})
    assert frame.content == ""


def test_supported_inbound_is_exactly_join_and_code_update():
    # D-08-mandated revision of `test_supported_inbound_is_exactly_join`:
    # code_update is supported inbound since Phase 4.
    assert SUPPORTED_INBOUND == frozenset({"join", "code_update"})


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


def test_frame_type_union_includes_snapshot_outbound():
    # D-06: `snapshot` is an outbound frame type in the union.
    assert typing.get_args(protocol.FrameType) == (
        "join",
        "code_update",
        "presence",
        "snapshot",
        "error",
    )


def test_snapshot_frame_shape():
    room_id = uuid.uuid4()
    frame = snapshot_frame(room_id, "print('x')", "python", "deadbeef", "req-1")
    assert set(frame) == {
        "type",
        "room_id",
        "content",
        "language",
        "content_hash",
        "request_id",
    }
    assert frame == {
        "type": "snapshot",
        "room_id": str(room_id),
        "content": "print('x')",
        "language": "python",
        "content_hash": "deadbeef",
        "request_id": "req-1",
    }
    # str room_id is accepted and echoed verbatim
    assert snapshot_frame(str(room_id), "", "python", "abc", "req-2") == {
        "type": "snapshot",
        "room_id": str(room_id),
        "content": "",
        "language": "python",
        "content_hash": "abc",
        "request_id": "req-2",
    }
    assert not {"nickname", "user_id", "users", "roster"} & set(frame)


def test_snapshot_frame_empty_content_is_valid():
    frame = snapshot_frame(uuid.uuid4(), "", "python", "empty-hash", "req-1")
    assert frame["content"] == ""
    assert frame["language"] == "python"


def test_module_purity():
    import inspect

    source = inspect.getsource(protocol)
    assert "await" not in source
    assert "WebSocket" not in source
    assert "AsyncSession" not in source


def test_code_update_broadcast_frame_shape():
    room_id = uuid.uuid4()
    frame = code_update_broadcast_frame(room_id, "print('x')", "deadbeef", "req-1")
    assert set(frame) == {"type", "room_id", "content", "content_hash", "request_id"}
    assert frame == {
        "type": "code_update",
        "room_id": str(room_id),
        "content": "print('x')",
        "content_hash": "deadbeef",
        "request_id": "req-1",
    }
    # no sender-only fields: request_id is the recipient's own (D-09/D-13)
    assert not {"nickname", "user_id", "users", "roster", "language"} & set(frame)


def test_code_update_broadcast_frame_accepts_str_room_id():
    room_id = str(uuid.uuid4())
    frame = code_update_broadcast_frame(room_id, "x", "h", "req-2")
    assert frame["room_id"] == room_id


def test_error_frame_message_override_keeps_closed_code():
    frame = error_frame(
        ErrorCode.VALIDATION_ERROR,
        "req-1",
        message="O código excede o limite de 256 KiB.",
    )
    assert frame["error"]["code"] == "validation_error"
    assert frame["error"]["message"] == "O código excede o limite de 256 KiB."
    assert frame["error"]["request_id"] == "req-1"


def test_error_frame_without_message_uses_default_table():
    code = next(iter(ERROR_MESSAGES))
    frame = error_frame(code, "req-1")
    assert frame["error"]["message"] == ERROR_MESSAGES[code]


def test_oversize_code_update_refusal_names_the_256_kib_limit():
    # D-02: the oversize refusal keeps code == validation_error and its
    # Portuguese message names the 256 KiB limit.
    frame = error_frame(
        ErrorCode.VALIDATION_ERROR,
        "req-1",
        message="O código excede o limite de 256 KiB.",
    )
    assert frame["error"]["code"] == ErrorCode.VALIDATION_ERROR
    assert "256 KiB" in frame["error"]["message"]
