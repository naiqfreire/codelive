"""Per-room WebSocket connection registry — process memory only.

No table, file or history is kept: the registry lives only for the sockets'
lifetime. Connections are indexed by ``room_id``; registry mutations are
synchronous and take no lock (no ``await`` inside them). ``broadcast``
iterates a tuple snapshot of the room, calls a per-recipient frame factory,
collects send failures and evicts the failing sockets after the loop.
"""
import uuid
from collections.abc import Callable
from dataclasses import dataclass

from fastapi import WebSocket


@dataclass
class Connection:
    websocket: WebSocket
    role: str  # "owner" | "viewer", resolved once at the handshake (D-10)
    user_id: uuid.UUID | None
    anonymous: bool
    joined: bool = False
    request_id: str = ""  # minted at this socket's accept (D-13)


class RoomHub:
    """Room-indexed registry of live sockets (room_id -> id(websocket) -> Connection)."""

    def __init__(self) -> None:
        self._rooms: dict[uuid.UUID, dict[int, Connection]] = {}

    def add(self, room_id: uuid.UUID, conn: Connection) -> int:
        """Register conn; idempotent per socket. Returns the room's count."""
        room = self._rooms.setdefault(room_id, {})
        room[id(conn.websocket)] = conn
        return len(room)

    def remove(self, room_id: uuid.UUID, conn: Connection) -> int:
        """Evict conn; drops the room key when empty. Returns the new count."""
        room = self._rooms.get(room_id)
        if room is None:
            return 0
        room.pop(id(conn.websocket), None)
        if not room:
            del self._rooms[room_id]
            return 0
        return len(room)

    def count(self, room_id: uuid.UUID) -> int:
        return len(self._rooms.get(room_id, {}))

    def reset(self) -> None:
        self._rooms.clear()

    async def broadcast(
        self, room_id: uuid.UUID, build: Callable[[Connection], dict]
    ) -> None:
        """Send ``build(conn)`` to every joined socket in the room.

        The frame is built per recipient (presence.role is the recipient's
        own role, D-11). Failing sockets are removed after the loop; the
        loop itself never raises.
        """
        failed: list[Connection] = []
        for conn in tuple(self._rooms.get(room_id, {}).values()):
            try:
                await conn.websocket.send_json(build(conn))
            except Exception:
                failed.append(conn)
        for conn in failed:
            self.remove(room_id, conn)


hub = RoomHub()
