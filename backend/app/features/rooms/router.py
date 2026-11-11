"""Rooms HTTP routes."""
import secrets
import uuid

import structlog
from fastapi import APIRouter, Depends, Request, Response
from itsdangerous import BadSignature, SignatureExpired
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.auth.public import get_current_user_optional, require_authenticated
from app.features.rooms import service
from app.features.rooms.schemas import (
    ByCodeResponse,
    CreateRoomRequest,
    JoinRequest,
    ListJoinedResponse,
    RoomOut,
)
from app.shared.config import Settings, get_settings
from app.shared.database import get_session
from app.shared.security import (
    ANONYMOUS_COOKIE_NAME,
    ANONYMOUS_MAX_AGE,
    issue_anonymous_session,
    read_anonymous_session,
)

log = structlog.get_logger()

router = APIRouter(dependencies=[Depends(require_authenticated)])
public_router = APIRouter()


@router.post("", status_code=201, response_model=RoomOut)
async def create_room(
    data: CreateRoomRequest,
    user=Depends(require_authenticated),
    session: AsyncSession = Depends(get_session),
):
    room = await service.create_room(session, user, data.language)
    log.info("room_created", room_id=str(room.id), user_id=str(user.id), language=data.language)
    return room


@router.get("/mine", response_model=list[RoomOut])
async def list_my_rooms(
    user=Depends(require_authenticated),
    session: AsyncSession = Depends(get_session),
):
    return await service.list_rooms_for_owner(session, user)


@router.get("/by-code/{codigo}", response_model=ByCodeResponse)
async def get_room_by_code(
    codigo: str,
    user=Depends(require_authenticated),
    session: AsyncSession = Depends(get_session),
):
    room = await service.get_room_by_code(session, codigo)
    log.info("room_by_code_lookup", room_id=str(room.id), user_id=str(user.id))
    return room


@router.get("/joined", response_model=ListJoinedResponse)
async def list_joined_rooms(
    user=Depends(require_authenticated),
    session: AsyncSession = Depends(get_session),
):
    return await service.list_rooms_joined(session, user)


@router.patch("/{room_id}/close", response_model=RoomOut)
async def close_room(
    room_id: uuid.UUID,
    user=Depends(require_authenticated),
    session: AsyncSession = Depends(get_session),
):
    room = await service.close_room(session, room_id, user)
    log.info("room_closed", room_id=str(room.id), user_id=str(user.id))
    return room


@router.post("/{room_id}/regenerate-code", response_model=RoomOut)
async def regenerate_room_code(
    room_id: uuid.UUID,
    user=Depends(require_authenticated),
    session: AsyncSession = Depends(get_session),
):
    room = await service.regenerate_room_code(session, room_id, user)
    log.info("room_code_regenerated", room_id=str(room.id), user_id=str(user.id))
    return room


@public_router.post("/{room_id}/join", status_code=200, response_model=RoomOut)
async def join_room(
    room_id: uuid.UUID,
    data: JoinRequest,
    request: Request,
    response: Response,
    user=Depends(get_current_user_optional),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_settings),
):
    secret = settings.SESSION_SECRET.get_secret_value()
    anonymous_session_id = None
    is_new_anonymous = False

    if data.anonymous:
        token = request.cookies.get(ANONYMOUS_COOKIE_NAME)
        if token:
            try:
                anonymous_session_id = read_anonymous_session(secret, token)
            except (BadSignature, SignatureExpired):
                anonymous_session_id = None
        if not anonymous_session_id:
            anonymous_session_id = secrets.token_urlsafe(32)
            is_new_anonymous = True

    room = await service.join_room(
        session,
        room_id,
        user,
        data.code,
        anonymous=data.anonymous,
        nickname=data.nickname,
        anonymous_session_id=anonymous_session_id,
    )

    if is_new_anonymous and anonymous_session_id:
        response.set_cookie(
            ANONYMOUS_COOKIE_NAME,
            issue_anonymous_session(secret, anonymous_session_id),
            max_age=ANONYMOUS_MAX_AGE,
            path="/",
            secure=True,
            httponly=True,
            samesite="lax",
        )

    log.info(
        "room_joined",
        room_id=str(room.id),
        user_id=str(user.id) if user else None,
        anonymous=data.anonymous,
    )
    return room
