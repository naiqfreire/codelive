"""Unit: per-room connection registry. No database."""
import uuid

import pytest

from app.features.live_code.hub import Connection, hub


def setup_function():
    hub.reset()


def teardown_function():
    hub.reset()


class _StubSocket:
    def __init__(self, on_send=None, fail=False):
        self.sent = []
        self.on_send = on_send
        self.fail = fail

    async def send_json(self, frame):
        if self.fail:
            raise RuntimeError("send failed")
        if self.on_send is not None:
            self.on_send()
        self.sent.append(frame)


def _conn(role="viewer", socket=None):
    return Connection(
        websocket=socket or _StubSocket(),
        role=role,
        user_id=None,
        anonymous=True,
        joined=True,
    )


@pytest.mark.asyncio
async def test_broadcast_is_room_scoped():
    room_a, room_b = uuid.uuid4(), uuid.uuid4()
    sock_a1, sock_a2, sock_b = _StubSocket(), _StubSocket(), _StubSocket()
    hub.add(room_a, _conn(socket=sock_a1))
    hub.add(room_a, _conn(socket=sock_a2))
    hub.add(room_b, _conn(socket=sock_b))

    await hub.broadcast(room_a, lambda conn: {"type": "presence", "count": hub.count(room_a)})

    assert len(sock_a1.sent) == 1
    assert len(sock_a2.sent) == 1
    assert sock_b.sent == []
    assert hub.count(room_a) == 2
    assert hub.count(room_b) == 1


@pytest.mark.asyncio
async def test_remove_during_broadcast_is_safe():
    room = uuid.uuid4()
    peer_conn = _conn()
    remover_conn = _conn(socket=_StubSocket(on_send=lambda: hub.remove(room, peer_conn)))
    hub.add(room, remover_conn)
    hub.add(room, peer_conn)

    await hub.broadcast(room, lambda conn: {"type": "presence"})

    # the peer was removed mid-broadcast by the other stub; no error raised
    assert peer_conn.websocket.sent == [{"type": "presence"}]
    assert hub.count(room) == 1


@pytest.mark.asyncio
async def test_broadcast_uses_per_recipient_frame_factory():
    room = uuid.uuid4()
    owner = _conn(role="owner")
    viewer = _conn(role="viewer")
    hub.add(room, owner)
    hub.add(room, viewer)

    await hub.broadcast(
        room,
        lambda conn: {"type": "presence", "count": 2, "role": conn.role},
    )

    assert owner.websocket.sent[0]["role"] == "owner"
    assert viewer.websocket.sent[0]["role"] == "viewer"
    assert owner.websocket.sent[0]["count"] == viewer.websocket.sent[0]["count"] == 2


def test_add_is_idempotent_per_socket():
    room = uuid.uuid4()
    conn = _conn()
    hub.add(room, conn)
    hub.add(room, conn)
    assert hub.count(room) == 1


def test_remove_deletes_empty_room():
    room = uuid.uuid4()
    conn = _conn()
    hub.add(room, conn)
    assert hub.remove(room, conn) == 0
    assert hub.count(room) == 0
    assert hub.count(uuid.uuid4()) == 0


@pytest.mark.asyncio
async def test_send_failure_disconnects_and_removes():
    room = uuid.uuid4()
    failing = _conn(socket=_StubSocket(fail=True))
    healthy = _conn()
    hub.add(room, failing)
    hub.add(room, healthy)

    await hub.broadcast(room, lambda conn: {"type": "presence"})

    assert healthy.websocket.sent == [{"type": "presence"}]
    assert hub.count(room) == 1
    assert failing not in hub._rooms.get(room, {}).values()
