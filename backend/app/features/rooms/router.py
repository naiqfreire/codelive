"""Rooms HTTP routes."""
import structlog
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.auth.public import require_authenticated
from app.features.rooms import service
from app.features.rooms.schemas import CreateRoomRequest, RoomOut
from app.shared.database import get_session

log = structlog.get_logger()

router = APIRouter(dependencies=[Depends(require_authenticated)])


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
