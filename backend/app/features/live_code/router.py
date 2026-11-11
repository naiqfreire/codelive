"""WS route: /rooms/{room_id} — authorized handshake, join, presence."""
import json
import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import TYPE_CHECKING

import structlog
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from itsdangerous import BadSignature, SignatureExpired

from app.features.auth import public as auth
from app.features.live_code import protocol
from app.features.live_code.hub import Connection, hub
from app.features.rooms import public as rooms_public
from app.shared.config import Settings, get_settings
from app.shared.database import get_sessionmaker
from app.shared.errors import ErrorCode
from app.shared.middleware import new_request_id
from app.shared.security import ANONYMOUS_COOKIE_NAME, read_anonymous_session

if TYPE_CHECKING:
    from app.features.auth.models import User

log = structlog.get_logger()

router = APIRouter()


@dataclass
class Admission:
    request_id: str
    role: str
    user: "User | None"


async def ws_session_context(
    websocket: WebSocket, room_id: uuid.UUID
) -> AsyncIterator[str]:
    """Mint the session request_id; bind it (+ room_id) for the session's logs.

    Never clears contextvars — the binding exits when the socket session ends.
    """
    request_id = new_request_id()
    websocket.state.request_id = request_id
    with structlog.contextvars.bound_contextvars(
        request_id=request_id, room_id=str(room_id)
    ):
        yield request_id


async def admit(
    websocket: WebSocket,
    room_id: uuid.UUID,
    request_id: str = Depends(ws_session_context),
    settings: Settings = Depends(get_settings),
) -> Admission:
    """Authorize the handshake before accept (D-04..D-07, D-15, D-16, D-19).

    Order: Origin allow-list -> identity (session wins over anon, D-15) ->
    membership/role via rooms.authorize_room_identity. One short-lived
    session, closed before accept() — never Depends(get_session).
    """
    origin = websocket.headers.get("origin")
    allowed = {o.strip().rstrip("/").lower() for o in settings.ALLOWED_ORIGINS}
    if origin is None or origin.strip().rstrip("/").lower() not in allowed:
        raise HTTPException(status_code=403, detail=ErrorCode.INVALID_ORIGIN)

    async with get_sessionmaker()() as session:
        user = await auth.resolve_user(websocket, session, settings)
        anonymous_session_id = None
        if user is None:
            token = websocket.cookies.get(ANONYMOUS_COOKIE_NAME)
            if token:
                try:
                    anonymous_session_id = read_anonymous_session(
                        settings.SESSION_SECRET.get_secret_value(), token
                    )
                except (BadSignature, SignatureExpired):
                    anonymous_session_id = None
        if user is None and anonymous_session_id is None:
            raise HTTPException(status_code=401, detail=ErrorCode.NOT_AUTHENTICATED)
        _room, role = await rooms_public.authorize_room_identity(
            session, room_id, user, anonymous_session_id
        )
    # Session closes here, before accept().
    return Admission(request_id=request_id, role=role, user=user)


@router.websocket("/rooms/{room_id}")
async def room_channel(
    websocket: WebSocket,
    room_id: uuid.UUID,
    admission: Admission = Depends(admit),
) -> None:
    await websocket.accept()
    user = admission.user
    user_id = user.id if user is not None else None
    conn = Connection(
        websocket=websocket,
        role=admission.role,
        user_id=user_id,
        anonymous=user is None,
        request_id=admission.request_id,
    )
    log.info(
        "ws_connected",
        room_id=str(room_id),
        user_id=str(user_id) if user_id else None,
        anonymous=user is None,
    )
    try:
        while True:
            try:
                raw = await websocket.receive_json()
            except json.JSONDecodeError:
                await websocket.send_json(
                    protocol.error_frame(ErrorCode.VALIDATION_ERROR, admission.request_id)
                )
                continue
            try:
                frame = protocol.parse_frame(raw)
            except protocol.FrameError:
                await websocket.send_json(
                    protocol.error_frame(ErrorCode.VALIDATION_ERROR, admission.request_id)
                )
                continue
            if frame.type == "join":
                if conn.joined:
                    # Idempotent re-join: unchanged registry, presence to joiner only.
                    count = hub.count(room_id)
                    await websocket.send_json(
                        protocol.presence_frame(
                            room_id, count, conn.role, admission.request_id
                        )
                    )
                    continue
                conn.joined = True
                hub.add(room_id, conn)
                count = hub.count(room_id)
                log.info(
                    "ws_join",
                    room_id=str(room_id),
                    user_id=str(user_id) if user_id else None,
                    anonymous=user is None,
                )
                await hub.broadcast(
                    room_id,
                    lambda recipient: protocol.presence_frame(
                        room_id, count, recipient.role, recipient.request_id
                    ),
                )
    except WebSocketDisconnect:
        pass
    finally:
        if conn.joined:
            hub.remove(room_id, conn)
            count = hub.count(room_id)
            log.info(
                "ws_disconnected",
                room_id=str(room_id),
                user_id=str(user_id) if user_id else None,
                anonymous=user is None,
            )
            await hub.broadcast(
                room_id,
                lambda recipient: protocol.presence_frame(
                    room_id, count, recipient.role, recipient.request_id
                ),
            )
